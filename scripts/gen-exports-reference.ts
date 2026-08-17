/**
 * Generates the v2 "exports" reference pages from the blocks monorepo's
 * package.json `exports` maps — so the subpath list never drifts by hand again.
 *
 *   reference/package-exports.mdx   ← core packages (blocks, tanstack, nextjs, …)
 *   reference/commerce-exports.mdx  ← apps-* packages
 *
 * Emits both en and pt. The table structure (subpath → source file) is fully
 * generated; editorial one-liners live in DESCRIPTIONS and are optional — a
 * subpath with no entry falls back to showing its resolved source file, which
 * is accurate and never drifts.
 *
 * Run against a local blocks checkout:
 *   bun scripts/gen-exports-reference.ts --blocks-root=/abs/path/to/blocks
 * Self-check (no filesystem writes, asserts the row formatter):
 *   bun scripts/gen-exports-reference.ts --self-check
 *
 * ponytail: manual run now + whenever exports change. Wiring this into CI is
 * the deferred docs-gate workstream, not this script's job.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(HERE, "..", "client", "src", "content", "v2");

const CORE = [
  "blocks",
  "blocks-admin",
  "blocks-cli",
  "tanstack",
  "nextjs",
  "eitri",
];
const COMMERCE = [
  "apps-commerce",
  "apps-website",
  "apps-vtex",
  "apps-shopify",
  "apps-magento",
  "apps-salesforce",
  "apps-algolia",
  "apps-blog",
  "apps-resend",
];

/** Optional editorial one-liners, keyed by full subpath. Missing = show file. */
const DESCRIPTIONS: Record<string, string> = {
  // core
  "@decocms/blocks": "Barrel: CMS runtime entry.",
  "@decocms/blocks/cms": "Server-only CMS core: resolver, loader, registry.",
  "@decocms/blocks/cms/client":
    "Client-safe section registry + schema (browser-bundle safe).",
  "@decocms/blocks/hooks": "React UI integration hooks/components.",
  "@decocms/blocks/setup": "`createSiteSetup` — site bootstrap.",
  "@decocms/blocks/types": "Shared types (`Section`, `App`, `FnContext`, …).",
  "@decocms/blocks/types/widgets":
    "Widget types for section Props (`ImageWidget`, `RichText`, `Color`, …).",
  "@decocms/blocks-admin": "Admin protocol handlers (`handleMeta`, `handleRender`, `handleInvoke`, …).",
  "@decocms/blocks-admin/setup": "`createAdminSetup` — admin bootstrap.",
  "@decocms/blocks-admin/apps/autoconfig": "`autoconfigApps`.",
  "@decocms/blocks-cli/generate": "Unified incremental codegen orchestrator.",
  "@decocms/blocks-cli/generate-blocks": "`.deco/blocks/*.json` → `blocks.gen.json`.",
  "@decocms/tanstack": "TanStack Start binding: routes, worker entry, router SDK, hooks.",
  "@decocms/tanstack/vite": "`decoVitePlugin` (default).",
  "@decocms/tanstack/daemon": "Local dev tunnel + admin auth (advanced).",
  "@decocms/tanstack/sdk/createInvoke": "`createInvokeFn`.",
  "@decocms/tanstack/sdk/cookiePassthrough":
    "`getRequestCookieHeader`, `forwardResponseCookies`.",
  "@decocms/tanstack/sdk/deferredSectionLoader": "`deferredSectionLoader`.",
  "@decocms/nextjs": "Next.js App Router binding: `createDecoPage`, `createDecoPreviewPage`, `createNextSetup`.",
  "@decocms/nextjs/routeHandlers": "`createDecoRouteHandlers` — mount the admin protocol.",
  "@decocms/nextjs/setup": "`createNextSetup`.",
  "@decocms/nextjs/config": "`withDeco` (next.config wrapper).",
  "@decocms/eitri": "Eitri schema + decofile generator entry.",
  // commerce
  "@decocms/apps-commerce/types":
    "schema.org-aligned commerce types (`Product`, `ProductDetailsPage`, `Minicart`, …).",
  "@decocms/apps-commerce/types/cart":
    "Cart v2 contract: `CartProjection`, `CartSection`, `SECTIONS_*`, `defaultSectionsFor`.",
  "@decocms/apps-commerce/app-types": "`AppDefinition`, `AppMiddleware`, `ResolveSecretFn`.",
  "@decocms/apps-commerce/resolve": "`resolveApps` (compose `AppDefinition`s).",
  "@decocms/apps-commerce/registry": "`APP_REGISTRY` for `autoconfigApps`.",
  "@decocms/apps-vtex": "VTEX barrel index.",
  "@decocms/apps-vtex/commerceLoaders": "`createVtexCommerceLoaders`.",
  "@decocms/apps-vtex/client":
    "`vtexFetch`, `vtexFetchWithCookies`, `intelligentSearch`, `configureVtex`, `setVtexFetch`, …",
  "@decocms/apps-vtex/hooks":
    "Cart/user/wishlist hooks + factories: `useCart`, `useUser`, `useWishlist`, `createCart`, `createUseUser`, `createUseWishlist`.",
  "@decocms/apps-vtex/middleware":
    "`extractVtexContext`, `vtexCacheControl`, `propagateISCookies`, …",
  "@decocms/apps-shopify/client": "`setShopifyFetch`, GraphQL client helpers.",
  "@decocms/apps-website": "SEO/fonts/theme utility belt barrel.",
  "@decocms/apps-website/utils/*": "`configureWebsite`, `configureSeo`, …",
};

interface Pkg {
  name: string;
  exports?: Record<string, unknown>;
  bin?: Record<string, string>;
}

function readPkg(blocksRoot: string, dir: string): Pkg {
  const p = join(blocksRoot, "packages", dir, "package.json");
  return JSON.parse(readFileSync(p, "utf8")) as Pkg;
}

/** "." → pkg name; "./x/*" → "pkg/x/*". */
export function toSubpath(name: string, key: string): string {
  if (key === ".") return name;
  return name + key.slice(1);
}

/** Render one exports row: subpath + description-or-target. */
export function renderRow(name: string, key: string, target: unknown): string {
  const subpath = toSubpath(name, key);
  const desc = DESCRIPTIONS[subpath];
  let note: string;
  if (desc) {
    note = desc;
  } else if (target && typeof target === "object") {
    note = "_conditional export_ (" + Object.keys(target).join(" / ") + ")";
  } else {
    note = "`" + String(target).replace(/^\.\//, "") + "`";
  }
  return "| `" + subpath + "` | " + note + " |";
}

function renderPackage(pkg: Pkg): string {
  const lines: string[] = [];
  lines.push("## `" + pkg.name + "`", "");
  lines.push("| Subpath | Exports / resolves to |", "|---|---|");
  const exp = pkg.exports ?? {};
  for (const key of Object.keys(exp)) {
    lines.push(renderRow(pkg.name, key, exp[key]));
  }
  lines.push("");
  if (pkg.bin && Object.keys(pkg.bin).length > 0) {
    lines.push("**Bin:** " + Object.keys(pkg.bin).map((b) => "`" + b + "`").join(", "), "");
  }
  return lines.join("\n");
}

const T = {
  en: {
    pkgTitle: "Package exports",
    pkgDesc:
      "Generated export tables for the core @decocms/* packages (post-split monorepo).",
    comTitle: "Commerce app exports",
    comDesc:
      "Generated export tables for the @decocms/apps-* commerce and website packages.",
    generated:
      "**Generated file.** This page is produced by `scripts/gen-exports-reference.ts` from each package's `package.json` `exports` map. Do not edit by hand — re-run the generator against a blocks checkout instead.",
    pkgIntro:
      "The framework split the former single `@decocms/start` package into focused packages. Each subpath below resolves straight to source — there is no bundled dist tier.",
    comIntro:
      "Commerce and website capabilities ship as `@decocms/apps-*` packages (formerly subpaths of `@decocms/apps`).",
  },
  pt: {
    pkgTitle: "Exports dos pacotes",
    pkgDesc:
      "Tabelas de export geradas para os pacotes core @decocms/* (monorepo pós-split).",
    comTitle: "Exports dos apps de commerce",
    comDesc:
      "Tabelas de export geradas para os pacotes de commerce e website @decocms/apps-*.",
    generated:
      "**Arquivo gerado.** Esta página é produzida por `scripts/gen-exports-reference.ts` a partir do mapa `exports` do `package.json` de cada pacote. Não edite à mão — rode o gerador contra um checkout do blocks.",
    pkgIntro:
      "O framework quebrou o antigo pacote único `@decocms/start` em pacotes focados. Cada subpath abaixo resolve direto para o código-fonte — não há camada dist empacotada.",
    comIntro:
      "As capacidades de commerce e website são publicadas como pacotes `@decocms/apps-*` (antes subpaths de `@decocms/apps`).",
  },
} as const;

function buildPage(
  locale: "en" | "pt",
  kind: "pkg" | "com",
  pkgs: Pkg[],
): string {
  const t = T[locale];
  const title = kind === "pkg" ? t.pkgTitle : t.comTitle;
  const desc = kind === "pkg" ? t.pkgDesc : t.comDesc;
  const intro = kind === "pkg" ? t.pkgIntro : t.comIntro;
  const head = [
    "---",
    `title: "${title}"`,
    `description: "${desc}"`,
    'icon: "Package"',
    "---",
    "",
    'import Callout from "../../../../components/ui/Callout.astro";',
    "",
    intro,
    "",
    '<Callout type="info">',
    t.generated,
    "</Callout>",
    "",
    "",
  ].join("\n");
  return head + pkgs.map(renderPackage).join("\n") + "\n";
}

function selfCheck(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error("self-check failed: " + msg);
  };
  assert(toSubpath("@decocms/blocks", ".") === "@decocms/blocks", "root subpath");
  assert(
    toSubpath("@decocms/blocks", "./sdk/*") === "@decocms/blocks/sdk/*",
    "glob subpath",
  );
  // known description path
  assert(
    renderRow("@decocms/blocks", "./cms", "./src/cms/index.ts") ===
      "| `@decocms/blocks/cms` | Server-only CMS core: resolver, loader, registry. |",
    "editorial row",
  );
  // fallback to file
  assert(
    renderRow("@decocms/blocks", "./sdk/clx", "./src/sdk/clx.ts") ===
      "| `@decocms/blocks/sdk/clx` | `src/sdk/clx.ts` |",
    "fallback row",
  );
  // conditional export (subpath with no editorial entry)
  assert(
    renderRow("@decocms/blocks", "./sdk/requestContextStorage", {
      workerd: "x",
      browser: "y",
    }) ===
      "| `@decocms/blocks/sdk/requestContextStorage` | _conditional export_ (workerd / browser) |",
    "conditional row",
  );
  console.log("self-check OK");
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--self-check")) {
    selfCheck();
    return;
  }
  const rootArg = args.find((a) => a.startsWith("--blocks-root="));
  if (!rootArg) {
    console.error(
      "usage: bun scripts/gen-exports-reference.ts --blocks-root=/abs/path/to/blocks",
    );
    process.exit(1);
  }
  const blocksRoot = rootArg.split("=")[1];
  if (!existsSync(join(blocksRoot, "packages"))) {
    console.error("no packages/ under --blocks-root: " + blocksRoot);
    process.exit(1);
  }
  const core = CORE.map((d) => readPkg(blocksRoot, d));
  const commerce = COMMERCE.map((d) => readPkg(blocksRoot, d));

  for (const locale of ["en", "pt"] as const) {
    writeFileSync(
      join(CONTENT, locale, "reference", "package-exports.mdx"),
      buildPage(locale, "pkg", core),
    );
    writeFileSync(
      join(CONTENT, locale, "reference", "commerce-exports.mdx"),
      buildPage(locale, "com", commerce),
    );
  }
  console.log("wrote package-exports.mdx + commerce-exports.mdx (en, pt)");
}

main();
