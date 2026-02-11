// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

/**
 * Patches the CSR redirect to delete the root index files.
 * @returns {import("astro").AstroIntegration}
 */
function patchCsrRedirect() {
  return {
    name: "patch-csr-redirect",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const filesToDelete = [
          "index.html",
          "en/index.html",
          "pt/index.html",
        ];
        for (const file of filesToDelete) {
          try {
            await unlink(join(dir.pathname, file));
            console.log(`[CSR Redirect Patch] Deleted ${file}`);
          } catch {
            // File may not exist, ignore
          }
        }
      },
    },
  };
}

/**
 * Runs Pagefind after build and serves the index during dev.
 * @returns {import("astro").AstroIntegration}
 */
function pagefindIntegration() {
  const pagefindDir = join(import.meta.dirname, "..", "dist", "client", "pagefind");

  return {
    name: "pagefind-index",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [{
              name: "vite-plugin-pagefind-dev",
              configureServer(server) {
                const mimeTypes = /** @type {Record<string, string>} */ ({
                  js: "application/javascript",
                  json: "application/json",
                  css: "text/css",
                  wasm: "application/wasm",
                });

                server.middlewares.use(async (req, res, next) => {
                  const urlPath = req.url?.split("?")[0];
                  if (!urlPath?.startsWith("/pagefind/")) return next();

                  const filePath = join(pagefindDir, urlPath.replace("/pagefind/", ""));
                  if (!existsSync(filePath)) return next();

                  const ext = filePath.split(".").pop() || "";
                  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
                  res.end(await readFile(filePath));
                });
              },
            }],
          },
        });
      },
      "astro:build:done": async ({ dir }) => {
        execSync(`./node_modules/.bin/pagefind --site "${dir.pathname}"`, { stdio: "inherit", cwd: join(import.meta.dirname, "..") });
        console.log("[Pagefind] Search index generated");
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4000,
  },
  redirects: {},
  outDir: "../dist/client",
  i18n: {
    locales: ["en", "pt"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: true,
    },
  },
  integrations: [mdx(), react(), patchCsrRedirect(), pagefindIntegration()],
  vite: {
    plugins: [
      // @ts-ignore: tailwindcss plugin type issue
      tailwindcss(),
    ],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: "light",
    },
  },
});
