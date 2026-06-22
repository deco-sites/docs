import { createTool } from "@decocms/runtime/tools";
import { createClient } from "@supabase/supabase-js";
import { embed, generateText } from "ai";
import { z } from "zod";
import { chatModel, embeddingModel } from "../lib/mesh-provider";
import { reformulateQuery } from "../lib/query-reformulation";
import { rerankResults } from "../lib/reranker";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const SYSTEM_PROMPT = `You are a helpful assistant for deco.cx documentation.
Answer questions based on the provided documentation context.
If the context doesn't contain relevant information, say so honestly.
Always be concise and helpful. Respond in the same language as the user's question.`;

export const assistantTool = createTool({
  id: "DOCS_ASSISTANT",
  description: "Ask questions about deco.cx and get AI-generated answers based on the documentation.",
  inputSchema: z.object({
    question: z.string().describe("The question to ask about deco.cx"),
    language: z.enum(["en", "pt"]).optional().describe("Preferred language for docs (optional)"),
  }),
  outputSchema: z.object({
    answer: z.string(),
    sources: z.array(z.object({
      title: z.string(),
      source: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { question, language } = context;

    const RETRIEVAL_POOL_SIZE = 20;
    const TOP_K = 5;

    const optimizedQuery = await reformulateQuery(question);

    const { embedding } = await embed({
      model: embeddingModel(),
      value: optimizedQuery,
    });

    const filter = language ? { language } : {};
    const { data: docs, error } = await supabase.rpc("hybrid_search", {
      query_text: question,
      query_embedding: embedding,
      match_count: RETRIEVAL_POOL_SIZE,
      rrf_k: 60,
      semantic_weight: 0.5,
      filter_metadata: filter,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    const candidates = (docs || []).map((doc: any) => ({
      content: doc.content,
      title: doc.metadata?.title || "Untitled",
      source: doc.metadata?.source || "",
    }));

    const reranked = await rerankResults(question, candidates);
    const topDocs = reranked.slice(0, TOP_K);

    const docsContext = topDocs
      .map((doc, i) => `[${i + 1}] ${doc.title}\n${doc.content}`)
      .join("\n\n---\n\n");

    const { text } = await generateText({
      model: chatModel(),
      system: SYSTEM_PROMPT,
      prompt: `Context from documentation:\n\n${docsContext}\n\n---\n\nQuestion: ${question}`,
      temperature: 0.3,
      maxOutputTokens: 1000,
    });

    const answer = text || "Sorry, I couldn't generate an answer.";

    const sources = topDocs.map((doc) => ({
      title: doc.title,
      source: doc.source,
    }));

    return { answer, sources };
  },
});
