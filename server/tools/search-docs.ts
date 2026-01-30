import { createTool } from "@decocms/runtime/tools";
import { createClient } from "@supabase/supabase-js";
import { embed } from "ai";
import { z } from "zod";
import { embeddingModel } from "../lib/mesh-provider";
import { reformulateQuery } from "../lib/query-reformulation";
import { rerankResults } from "../lib/reranker";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const searchDocsTool = createTool({
  id: "SEARCH_DOCS",
  description: "Search the deco.cx documentation. Returns relevant results based on the query.",
  inputSchema: z.object({
    query: z.string().describe("The search query in natural language"),
    language: z.enum(["en", "pt"]).optional().describe("Filter by language (optional)"),
    limit: z.number().min(1).max(20).optional().describe("Number of results to return (default: 5)"),
    semanticWeight: z.number().min(0).max(1).optional().describe("Weight for semantic search vs full-text (0-1, default: 0.5)"),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      content: z.string(),
      title: z.string(),
      source: z.string(),
      section: z.string(),
      similarity: z.number(),
      ftsRank: z.number(),
      hybridScore: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const { query, language, limit = 5, semanticWeight = 0.5 } = context;

    const RETRIEVAL_POOL_SIZE = 20;

    const optimizedQuery = await reformulateQuery(query);

    const { embedding } = await embed({
      model: embeddingModel(),
      value: optimizedQuery,
    });

    const filter = language ? { language } : {};

    const { data, error } = await supabase.rpc("hybrid_search", {
      query_text: query,
      query_embedding: embedding,
      match_count: RETRIEVAL_POOL_SIZE,
      rrf_k: 60,
      semantic_weight: semanticWeight,
      filter_metadata: filter,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    const candidates = (data || []).map((doc: any) => ({
      content: doc.content,
      title: doc.metadata?.title || "Untitled",
      source: doc.metadata?.source || "",
      section: doc.metadata?.section || "",
      similarity: doc.similarity,
      ftsRank: doc.fts_rank || 0,
      hybridScore: doc.hybrid_score,
    }));

    const reranked = await rerankResults(query, candidates);

    return { results: reranked.slice(0, limit) };
  },
});
