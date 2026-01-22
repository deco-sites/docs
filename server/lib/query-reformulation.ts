import { generateText } from "ai";
import { chatModel } from "./mesh-provider";

const REFORMULATION_PROMPT = `You are a query optimizer for semantic search in a documentation database.
Your task is to transform user questions into optimized search queries.

Rules:
1. Extract the main concepts and keywords from the question
2. Remove filler words and question structure
3. Keep technical terms intact
4. Output a concise search query (max 10 words)
5. Output ONLY the reformulated query, nothing else
6. Keep the same language as the input

Examples:
- "O que é uma section no deco.cx?" → "section deco.cx definição conceito"
- "How do I create a new page?" → "create new page tutorial"
- "Como faço para editar uma seção?" → "editar seção como fazer"
- "What are the best practices for loaders?" → "loaders best practices guidelines"`;

export async function reformulateQuery(query: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: chatModel(),
      system: REFORMULATION_PROMPT,
      prompt: query,
      temperature: 0,
      maxOutputTokens: 50,
    });

    return text?.trim() || query;
  } catch (error) {
    console.error("Query reformulation failed, using original query:", error);
    return query;
  }
}
