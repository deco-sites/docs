import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "./mesh-provider";

interface RankCandidate {
  content: string;
  title: string;
  [key: string]: unknown;
}

const RERANK_PROMPT = `You are a relevance judge. Given a search query and a list of document excerpts, score each document's relevance to the query.

Score each document from 0 to 10:
- 0: Completely irrelevant
- 1-3: Tangentially related but doesn't answer the query
- 4-6: Partially relevant, contains some useful information
- 7-9: Highly relevant, directly addresses the query
- 10: Perfect match, exactly what the user is looking for

Be strict. Most documents should score below 5 unless they truly address the query.`;

export async function rerankResults<T extends RankCandidate>(
  query: string,
  candidates: T[],
): Promise<T[]> {
  if (candidates.length === 0) return candidates;

  try {
    const docsText = candidates
      .map((doc, i) => `[${i}] ${doc.title}\n${doc.content.slice(0, 300)}`)
      .join("\n\n");

    const { object } = await generateObject({
      model: chatModel(),
      schema: z.object({
        scores: z
          .array(z.number().min(0).max(10))
          .describe("Relevance score for each document, in the same order"),
      }),
      system: RERANK_PROMPT,
      prompt: `Query: ${query}\n\nDocuments:\n${docsText}`,
      temperature: 0,
    });

    const { scores } = object;

    if (scores.length !== candidates.length) {
      console.warn(
        `Reranker returned ${scores.length} scores for ${candidates.length} docs, using original order`,
      );
      return candidates;
    }

    const indexed = candidates.map((doc, i) => ({ doc, score: scores[i] }));
    indexed.sort((a, b) => b.score - a.score);

    return indexed.map((item) => item.doc);
  } catch (error) {
    console.error("Reranking failed, using original order:", error);
    return candidates;
  }
}
