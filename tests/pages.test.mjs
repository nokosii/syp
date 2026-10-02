import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicApi } from "../lib/public-api.ts";
import { retrieve } from "../lib/retrieval.ts";
import { EMBEDDING_MODEL } from "../lib/knowledge.ts";
const queries = JSON.parse(readFileSync(new URL("./semantic-queries.json", import.meta.url)));
const index = JSON.parse(readFileSync(new URL("../lib/demo-index.json", import.meta.url)));

test("Pages publishes six consented examples and twelve traceable paragraphs", async () => {
  const { documents } = await publicApi("/api/documents");
  assert.equal(documents.length, 6);
  assert.equal(documents.reduce((n, d) => n + d.chunkCount, 0), 12);
  assert.ok(documents.every(d => d.status === "published" && d.consent && d.isDemo));
  assert.ok(documents.every(d => !("chunks" in d)));
  assert.equal((await publicApi("/api/documents/demo-coast")).content, index.documents[0].content);
});
test("Pages semantic search uses the same source ranking as the backend", async () => {
  const sources = index.documents.flatMap(d => d.chunks.map((c, position) => ({
    id: `${d.id}-${position}`, documentId: d.id, title: d.title, content: c.content,
    position, region: d.region, category: d.category, author: d.author,
    isDemo: d.isDemo, embedding: c.embedding, model: index.model,
  })));
  for (const [i, expected] of [[0, "demo-coast"], [1, "demo-river"], [2, "demo-language"], [3, undefined]]) {
    const q = { ...queries[i], model: EMBEDDING_MODEL };
    const { results } = await publicApi("/api/search", { method: "POST", body: JSON.stringify(q) });
    assert.deepEqual(results, retrieve(sources, q));
    assert.equal(results[0]?.documentId, expected);
  }
});
test("Pages filters examples and regions before returning results", async () => {
  const q = { ...queries[0], model: EMBEDDING_MODEL };
  for (const filters of [{ includeDemo: false }, { region: "平鎮", category: "口述歷史" }]) {
    const { results } = await publicApi("/api/search", { method: "POST", body: JSON.stringify({ ...q, ...filters }) });
    assert.deepEqual(results, []);
  }
  const { results, mode } = await publicApi("/api/search", { method: "POST", body: JSON.stringify({ query: "石滬" }) });
  assert.equal(mode, "keyword"); assert.equal(results[0].documentId, "demo-coast");
});
test("Pages rejects editing, private routes and incompatible query vectors", async () => {
  assert.deepEqual(await publicApi("/api/session"), { editor: false });
  for (const [path, options] of [["/api/documents?manage=1"], ["/api/documents", { method: "POST" }], ["/api/session", { method: "POST", body: '{"key":"any"}' }], ["/api/attachments/private-file"]]) {
    await assert.rejects(publicApi(path, options), /主系統/);
  }
  await assert.rejects(publicApi("/api/documents/private-draft"), /公開展示版/);
  await assert.rejects(publicApi("/api/search", { method: "POST", body: JSON.stringify({ query: "石滬", vector: [1], model: EMBEDDING_MODEL }) }), /向量/);
});
