import { pipeline, env } from "@huggingface/transformers";
import { writeFileSync, mkdirSync } from "node:fs";
import { demoDocuments } from "../lib/demo-documents.ts";
import { chunkText, EMBEDDING_MODEL } from "../lib/knowledge.ts";
env.cacheDir = ".model-cache";
env.backends.onnx.wasm.numThreads = 1;
console.log("Loading multilingual E5 q8 for the demonstration index…");
const encoder = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
const documents = [];
for (const document of demoDocuments) {
  const chunks = [];
  for (const content of chunkText(document.content)) {
    const output = await encoder(`passage: ${content}`, { pooling: "mean", normalize: true });
    chunks.push({ content, embedding: Array.from(output.data) });
  }
  documents.push({ ...document, chunks });
  console.log(`${document.id}: ${chunks.length} chunks`);
}
writeFileSync("lib/demo-index.json", JSON.stringify({ model: EMBEDDING_MODEL, documents }));
mkdirSync(".test-output", { recursive: true });
const queries = ["以前的漁民是怎麼把經驗教給下一代？", "想和同學調查附近小溪是否受到汙染，要留下哪些證據？", "訪問阿公阿婆時怎樣保留他們說的話又避免曝光個資？", "火星太空船引擎的推力是多少"];
const fixtures = [];
for (const query of queries) {
  const output = await encoder(`query: ${query}`, { pooling: "mean", normalize: true });
  const fixture = { query, vector: Array.from(output.data), model: EMBEDDING_MODEL };
  fixtures.push(fixture);
  writeFileSync(`.test-output/query-${queries.indexOf(query)}.json`, JSON.stringify(fixture));
}
mkdirSync("tests", { recursive: true });
writeFileSync("tests/semantic-queries.json", JSON.stringify(fixtures));
console.log("Demo index and semantic QA vectors saved.");
