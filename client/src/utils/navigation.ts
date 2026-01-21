import { getCollection } from "astro:content";

export interface NavigationLink {
  title: string;
  description?: string;
  href: string;
}

export async function getNavigationLinks(
  currentDocId: string,
  locale: string,
): Promise<{ previous?: NavigationLink; next?: NavigationLink }> {
  const allDocs = await getCollection("docs");
  const docs = allDocs.filter((doc) => doc.id.split("/")[0] === locale);

  // Define the correct order for navigation
  const order = [
    // Getting Started
    "getting-started/overview",
    "getting-started/creating-a-site",
    "getting-started/creating-a-new-page",
    "getting-started/changes-and-publishing",
    "getting-started/adding-an-app",
    "getting-started/custom-domains/apex-domains",
    "getting-started/gtm",

    // CMS Capabilities
    "cms-capabilities/home",
    "cms-capabilities/content/pages",
    "cms-capabilities/content/sections",
    "cms-capabilities/content/assets",
    "cms-capabilities/content/blog",
    "cms-capabilities/content/records",
    "cms-capabilities/content/releases",
    "cms-capabilities/advanced/loaders",
    "cms-capabilities/advanced/actions",
    "cms-capabilities/advanced/apps",
    "cms-capabilities/advanced/experiments",
    "cms-capabilities/advanced/redirects",
    "cms-capabilities/advanced/segments",
    "cms-capabilities/advanced/seo",
    "cms-capabilities/management/custom-domains",
    "cms-capabilities/management/apex-domains",

    // Developing Guide
    "developing-guide/setup",
    "developing-guide/hello-world",
    "developing-guide/editable-sections",
    "developing-guide/fetching-data",
    "developing-guide/creating-loaders",
    "developing-guide/htmx",
    "developing-guide/go-live-ab-testing",
    "developing-guide/examples",

    // Concepts
    "concepts/block",
    "concepts/section",
    "concepts/loader",
    "concepts/action",
    "concepts/matcher",
    "concepts/segment",
    "concepts/app",

    // Developing Capabilities
    "developing-capabilities/loaders",
    "developing-capabilities/analytics",
    "developing-capabilities/deco-records",
    "developing-capabilities/manage-block-access",
    "developing-capabilities/modifying-status",
    "developing-capabilities/troubleshooting",
    "developing-capabilities/section-properties/standard-data-types",
    "developing-capabilities/section-properties/utility-types",
    "developing-capabilities/section-properties/widgets",
    "developing-capabilities/section-properties/annotations",
    "developing-capabilities/section-properties/using-secrets",
    "developing-capabilities/sections/accept-a-section",
    "developing-capabilities/sections/loading-fallback",
    "developing-capabilities/sections/error-fallback",
    "developing-capabilities/sections/redirecting-users",
    "developing-capabilities/blocks/exporting-default-props",
    "developing-capabilities/interactive-sections/partial",
    "developing-capabilities/islands/actions",
    "developing-capabilities/islands/fetching-data-client",
    "developing-capabilities/apps/creating-an-app",
    "developing-capabilities/apps/making-an-app-installable",
    "developing-capabilities/apps/ab-test",

    // Decopilot
    "decopilot/how-to-access",
    "decopilot/assistant",

    // Performance
    "performance/why",
    "performance/guide",
    "performance/islands",
    "performance/loaders",
    "performance/caching-data-loaders",
    "performance/edge-async-render",
    "performance/lazy-3rd-party-scripts",
    "performance/medias/images",
    "performance/medias/fonts",
    "performance/medias/css",
    "performance/medias/svg-sprites",

    // SDK
    "sdk/headless-cms",
    "sdk/ab-test",
    "sdk/feature-flags",

    // API Reference
    "api-reference/invoke",
    "api-reference/use-script",
    "api-reference/use-section",

    // Self Host
    "self-host/architecture",
    "self-host/envs",
    "self-host/site",

    // Changelog
    "changelog/overview",
  ];

  // Sort docs according to the defined order
  const sortedDocs = docs.sort((a, b) => {
    const aPath = a.id.split("/").slice(1).join("/");
    const bPath = b.id.split("/").slice(1).join("/");

    const aIndex = order.indexOf(aPath);
    const bIndex = order.indexOf(bPath);

    // If both are in the order array, sort by their position
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // If only one is in the order array, it comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    // If neither is in the order array, sort alphabetically
    return aPath.localeCompare(bPath);
  });

  const currentIndex = sortedDocs.findIndex((doc) => doc.id === currentDocId);

  if (currentIndex === -1) {
    return {};
  }

  const previous = currentIndex > 0 ? sortedDocs[currentIndex - 1] : undefined;
  const next =
    currentIndex < sortedDocs.length - 1
      ? sortedDocs[currentIndex + 1]
      : undefined;

  return {
    previous: previous
      ? {
          title: previous.data.title,
          description: previous.data.description,
          href: `/${locale}/${previous.id.split("/").slice(1).join("/")}`,
        }
      : undefined,
    next: next
      ? {
          title: next.data.title,
          description: next.data.description,
          href: `/${locale}/${next.id.split("/").slice(1).join("/")}`,
        }
      : undefined,
  };
}
