const BASE_URL = "http://localhost:3000";

async function callTool(toolId: string, args: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}/mcp/call-tool/${toolId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  console.log("=== Testing SEARCH_DOCS ===\n");

  const searchResult = await callTool("SEARCH_DOCS", {
    query: "como criar section",
    language: "pt-br",
    limit: 3,
  });

  console.log("Results:");
  for (const r of searchResult.results) {
    console.log(`\n- ${r.title}`);
    console.log(`  Similarity: ${r.similarity?.toFixed(3)} | FTS: ${r.ftsRank?.toFixed(3)} | Hybrid: ${r.hybridScore?.toFixed(4)}`);
    console.log(`  Source: ${r.source}`);
    console.log(`  ${r.content.slice(0, 100)}...`);
  }

  console.log("\n\n=== Testing DOCS_ASSISTANT ===\n");

  const assistantResult = await callTool("DOCS_ASSISTANT", {
    question: "O que é uma section no deco.cx?",
    language: "pt-br",
  });

  console.log("Answer:", assistantResult.answer);
  console.log("\nSources:");
  for (const s of assistantResult.sources) {
    console.log(`- ${s.title}: ${s.source}`);
  }
}

main().catch(console.error);
