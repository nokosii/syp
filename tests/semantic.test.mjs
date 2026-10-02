import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chunkText, cosine, EMBEDDING_MODEL, validEmbedding } from "../lib/knowledge.ts";
const index = JSON.parse(readFileSync(new URL("../lib/demo-index.json", import.meta.url)));
const queries = JSON.parse(readFileSync(new URL("./semantic-queries.json", import.meta.url)));
test("Stored Chinese source index is traceable and compatible with the query model", () => {
  assert.equal(index.model, EMBEDDING_MODEL);
  for (const d of index.documents) {
    assert.equal(d.isDemo, true);
    assert.deepEqual(d.chunks.map(c => c.content), chunkText(d.content));
    assert.ok(d.chunks.every(c => validEmbedding(c.embedding)));
  }
});
for (const [i, expected] of [[0,"demo-coast"],[1,"demo-river"],[2,"demo-language"]]) {
  test(`Chinese semantic paraphrase: ${queries[i].query}`, () => {
    const q = queries[i]; assert.ok(validEmbedding(q.vector));
    const ranked = index.documents.flatMap(d => d.chunks.map(c => ({id:d.id,score:cosine(q.vector,c.embedding)}))).sort((a,b) => b.score-a.score);
    assert.equal(ranked[0].id, expected);
    assert.ok(ranked[0].score >= .84);
    // These are paraphrases, not questions copied into the source corpus.
    assert.ok(index.documents.every(d => !d.content.includes(q.query)));
  });
}
test("An unrelated question stays below the calibrated evidence threshold", () => {
  assert.ok(index.documents.every(d => d.chunks.every(c => cosine(queries[3].vector,c.embedding) < .84)));
});
