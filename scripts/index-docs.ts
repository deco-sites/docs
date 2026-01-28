import { createClient } from "@supabase/supabase-js";
import { Glob } from "bun";
import { embedMany } from "ai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embeddingModel } from "../server/lib/mesh-provider";

// Configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 50;

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Markdown-aware text splitter
const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

interface Frontmatter {
  title?: string;
  description?: string;
}

interface DocChunk {
  content: string;
  metadata: {
    source: string;
    title: string;
    description?: string;
    language: string;
    section: string;
  };
}

// Contextual Chunking: adds document context to chunk for better embeddings
function createContextualText(chunk: DocChunk): string {
  const { title, section, description } = chunk.metadata;

  const parts = [`Documento: ${title}`];
  if (section) parts.push(`Categoria: ${section}`);
  if (description) parts.push(`Descrição: ${description}`);

  const context = parts.join(" | ");
  return `${context}\n\n${chunk.content}`;
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const [, fm, body] = match;
  const frontmatter: Frontmatter = {};

  for (const line of fm.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key as keyof Frontmatter] = value;
    }
  }

  return { frontmatter, body };
}

function extractLanguage(path: string): string {
  if (path.includes("/pt/")) return "pt";
  if (path.includes("/en/")) return "en";
  return "unknown";
}

function extractSection(path: string): string {
  const parts = path.split("/content/")[1]?.split("/") || [];
  return parts.length >= 2 ? parts.slice(1, -1).join("/") : "";
}

async function processFile(filePath: string): Promise<DocChunk[]> {
  const content = await Bun.file(filePath).text();
  const { frontmatter, body } = parseFrontmatter(content);

  const language = extractLanguage(filePath);
  const section = extractSection(filePath);
  const title = frontmatter.title || filePath.split("/").pop()?.replace(".mdx", "") || "Untitled";

  const chunks = await splitter.splitText(body);

  return chunks.map((chunk) => ({
    content: chunk,
    metadata: {
      source: filePath,
      title,
      description: frontmatter.description,
      language,
      section,
    },
  }));
}

async function deleteExistingChunks(source: string): Promise<void> {
  await supabase
    .from("doc_chunks")
    .delete()
    .eq("metadata->>source", source);
}

async function insertChunks(chunks: DocChunk[], vectors: number[][]): Promise<void> {
  const rows = chunks.map((chunk, i) => ({
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: vectors[i],
  }));

  const { error } = await supabase.from("doc_chunks").insert(rows);
  if (error) throw new Error(`Insert failed: ${error.message}`);
}

async function indexDocs(): Promise<void> {
  console.log("Starting indexing...\n");

  const glob = new Glob("client/src/content/**/*.mdx");
  const files: string[] = [];
  for await (const file of glob.scan(".")) {
    files.push(file);
  }

  console.log(`Found ${files.length} files\n`);

  let totalChunks = 0;

  for (const file of files) {
    try {
      console.log(`Processing: ${file}`);

      await deleteExistingChunks(file);
      const chunks = await processFile(file);

      if (chunks.length === 0) {
        console.log(`  Skipped\n`);
        continue;
      }

      // Process in batches
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        // Contextual Chunking: embed with context, store without
        const textsWithContext = batch.map(createContextualText);

        const { embeddings } = await embedMany({
          model: embeddingModel(),
          values: textsWithContext,
        });

        await insertChunks(batch, embeddings);
      }

      totalChunks += chunks.length;
      console.log(`  ${chunks.length} chunks\n`);

    } catch (err) {
      console.error(`  Error: ${err}\n`);
    }
  }

  console.log(`\nDone! ${totalChunks} chunks created`);
}

indexDocs().catch(console.error);
