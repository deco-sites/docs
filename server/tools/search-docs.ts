import { createTool } from "@decocms/runtime/tools";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const searchDocsTool = createTool({
  id: "SEARCH_DOCS",
  description: "Search the deco.cx documentation using semantic search. Returns relevant documentation chunks based on the query.",
  inputSchema: z.object({
    query: z.string().describe("The search query in natural language"),
    language: z.enum(["en", "pt-br"]).optional().describe("Filter by language (optional)"),
    limit: z.number().min(1).max(20).optional().describe("Number of results to return (default: 5)"),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      content: z.string(),
      title: z.string(),
      source: z.string(),
      section: z.string(),
      similarity: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    const { query, language, limit = 5 } = context;

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const filter = language ? { language } : {};

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      filter_metadata: filter,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    const results = (data || []).map((doc: any) => ({
      content: doc.content,
      title: doc.metadata?.title || "Untitled",
      source: doc.metadata?.source || "",
      section: doc.metadata?.section || "",
      similarity: doc.similarity,
    }));

    return { results };
  },
});
