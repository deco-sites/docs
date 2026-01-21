import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const ORGANIZATION_ID = process.env.MESH_ORGANIZATION_ID ?? "";
const CONNECTION_ID = process.env.MESH_CONNECTION_ID ?? "";

export const mesh = createOpenAICompatible({
  name: "mesh",
  apiKey: process.env.MESH_API_KEY ?? "",
  baseURL: `https://mesh-admin.decocms.com/api/${ORGANIZATION_ID}/v1`,
});

// Language models
export const chatModel = (modelId: string = "openai/gpt-4o-mini") =>
  mesh.chatModel(`${CONNECTION_ID}:${modelId}`);

// Embedding models
export const embeddingModel = (modelId: string = "openai/text-embedding-3-small") =>
  mesh.textEmbeddingModel(`${CONNECTION_ID}:${modelId}`);
