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

const SYSTEM_PROMPT = `You are a helpful assistant for deco.cx documentation.
Answer questions based on the provided documentation context.
If the context doesn't contain relevant information, say so honestly.
Always be concise and helpful. Respond in the same language as the user's question.`;

export const assistantTool = createTool({
  id: "DOCS_ASSISTANT",
  description: "Ask questions about deco.cx and get AI-generated answers based on the documentation.",
  inputSchema: z.object({
    question: z.string().describe("The question to ask about deco.cx"),
    language: z.enum(["en", "pt-br"]).optional().describe("Preferred language for docs (optional)"),
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

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const filter = language ? { language } : {};
    const { data: docs, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      filter_metadata: filter,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    const docsContext = (docs || [])
      .map((doc: any, i: number) => `[${i + 1}] ${doc.metadata?.title || "Doc"}\n${doc.content}`)
      .join("\n\n---\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Context from documentation:\n\n${docsContext}\n\n---\n\nQuestion: ${question}`
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const answer = completion.choices[0]?.message?.content || "Sorry, I couldn't generate an answer.";

    const sources = (docs || []).map((doc: any) => ({
      title: doc.metadata?.title || "Untitled",
      source: doc.metadata?.source || "",
    }));

    return { answer, sources };
  },
});
