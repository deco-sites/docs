import { generateText } from "ai";
import { chatModel } from "./mesh-provider";

const REFORMULATION_PROMPT = `You are a query optimizer for semantic vector search in a documentation database.
Your task is to transform user questions into dense, meaning-rich sentences optimized for embedding similarity.

Rules:
1. Rephrase the question as a declarative statement that captures the full semantic meaning
2. Keep all technical terms intact
3. Include relevant synonyms or related terms inline to broaden recall
4. Output a single concise sentence (max 20 words)
5. Output ONLY the reformulated query, nothing else
6. Always output in English regardless of input language (embeddings work best in English)

Examples:
- "O que é uma section no deco.cx?" → "definition and concept of sections as UI building blocks in deco.cx"
- "How do I create a new page?" → "guide to creating and setting up a new page in deco.cx"
- "Como faço para editar uma seção?" → "how to edit and modify sections in deco.cx pages"
- "What are the best practices for loaders?" → "best practices and guidelines for using loaders and data fetching in deco.cx"`;

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
