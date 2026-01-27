import { withRuntime, type DefaultEnv } from "@decocms/runtime";
import { createAssetHandler, resolveClientDir } from "@decocms/runtime/asset-server";
import { z } from "zod";
import { searchDocsTool } from "./tools/search-docs";
import { assistantTool } from "./tools/assistant";

const StateSchema = z.object({});

type Env = DefaultEnv<typeof StateSchema>;

const rootRedirects: Record<string, string> = {
  "/": "/en/getting-started/overview",
  "/en": "/en/getting-started/overview",
  "/pt-br": "/pt-br/getting-started/overview",
};

const clientDir = resolveClientDir(import.meta.url, "../client");

const runtime = withRuntime({
  tools: [() => searchDocsTool, () => assistantTool],
  fetch: async (req, env) => {
    const url = new URL(req.url);
    if (rootRedirects[url.pathname]) {
      return Response.redirect(
        new URL(rootRedirects[url.pathname], req.url),
        302,
      );
    }

    const assetsHandler = createAssetHandler({
      env: process.env.NODE_ENV as "development" | "production" | "test",
      clientDir,
    });

    // Try the original request first
    const response = await assetsHandler(req);
    if (response) return response;

    // Workaround: try appending /index.html for directory-style URLs (Astro static build)
    if (!url.pathname.includes(".") && !url.pathname.endsWith("/")) {
      const indexUrl = new URL(req.url);
      indexUrl.pathname = `${url.pathname}/index.html`;
      const indexReq = new Request(indexUrl.toString(), req);
      const indexResponse = await assetsHandler(indexReq);
      if (indexResponse) return indexResponse;
    }

    return new Response("Not found", { status: 404 });
  },
});

export default runtime;
