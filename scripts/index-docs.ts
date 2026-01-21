import { createClient } from "@supabase/supabase-js";
import { Glob } from "bun";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// Configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 50;

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY!,
});

// Markdown-aware text splitter
const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

interface Frontmatter {
  title?: string;
  description?: string;
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
  if (path.includes("/pt-br/")) return "pt-br";
  if (path.includes("/en/")) return "en";
  return "unknown";
}

function extractSection(path: string): string {
  const parts = path.split("/content/")[1]?.split("/") || [];
  return parts.length >= 2 ? parts.slice(1, -1).join("/") : "";
}

async function processFile(filePath: string): Promise<Document[]> {
  const content = await Bun.file(filePath).text();
  const { frontmatter, body } = parseFrontmatter(content);

  const language = extractLanguage(filePath);
  const section = extractSection(filePath);
  const title = frontmatter.title || filePath.split("/").pop()?.replace(".mdx", "") || "Untitled";

  const docs = await splitter.createDocuments(
    [body],
    [{
      source: filePath,
      title,
      description: frontmatter.description,
      language,
      section,
    }]
  );

  return docs;
}

async function deleteExistingChunks(source: string): Promise<void> {
  await supabase
    .from("doc_chunks")
    .delete()
    .eq("metadata->>source", source);
}

async function insertChunks(docs: Document[], vectors: number[][]): Promise<void> {
  const rows = docs.map((doc, i) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
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
      const docs = await processFile(file);

      if (docs.length === 0) {
        console.log(`  Skipped\n`);
        continue;
      }

      // Process in batches
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        const texts = batch.map((d) => d.pageContent);
        const vectors = await embeddings.embedDocuments(texts);
        await insertChunks(batch, vectors);
      }

      totalChunks += docs.length;
      console.log(`  ${docs.length} chunks\n`);

    } catch (err) {
      console.error(`  Error: ${err}\n`);
    }
  }

  console.log(`\nDone! ${totalChunks} chunks created`);
}

indexDocs().catch(console.error);
