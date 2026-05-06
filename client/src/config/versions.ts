export interface VersionConfig {
  /** Internal id, also used as the root segment of the doc id. */
  id: string;
  /** Long label for the picker. */
  label: string;
  /** Short label for compact UI. */
  shortLabel: string;
  description: string;
  /** Marks the default version. Exactly one entry should set this to true. */
  isLatest: boolean;
  /** Slug of the version's home page, relative to the locale. */
  root: string;
  /**
   * URL prefix below the domain. Empty for the default version
   * (so existing URLs do not break).
   */
  urlPrefix: string;
}

export const versions: VersionConfig[] = [
  {
    id: "v1",
    label: "v1 — Fresh / Deno",
    shortLabel: "v1",
    description: "Stable docs for the Fresh-based deco.cx",
    isLatest: true,
    root: "getting-started/overview",
    urlPrefix: "",
  },
  {
    id: "v2",
    label: "v2 — TanStack / React",
    shortLabel: "v2",
    description: "Preview docs for the TanStack-based deco.cx",
    isLatest: false,
    root: "getting-started/overview",
    urlPrefix: "/v2",
  },
];

export const LATEST_VERSION = versions.find((v) => v.isLatest)!;
export const VERSION_IDS = versions.map((v) => v.id);

export function getVersion(id: string): VersionConfig | undefined {
  return versions.find((v) => v.id === id);
}

/** Build a URL for a given version, locale and slug. */
export function buildVersionUrl(
  version: VersionConfig,
  locale: string,
  slug: string,
): string {
  return `${version.urlPrefix}/${locale}/${slug}`;
}

/** Convenience: URL of a version's root for a locale. */
export function buildVersionRootUrl(
  version: VersionConfig,
  locale: string,
): string {
  return buildVersionUrl(version, locale, version.root);
}
