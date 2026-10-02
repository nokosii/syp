import { cosine, EMBEDDING_MODEL, lexicalScore, validEmbedding, type SearchResult } from "./knowledge.ts";

export interface IndexedSource extends Omit<SearchResult, "score"> { embedding: number[]; model: string }
export interface RetrievalQuery { query: string; vector?: number[]; model?: string; region?: string; category?: string; includeDemo?: boolean }

// Both the database-backed site and the public Pages snapshot use this ranking.
export function retrieve(sources: IndexedSource[], q: RetrievalQuery): SearchResult[] {
  const semantic = q.vector !== undefined;
  if (semantic && (q.model !== EMBEDDING_MODEL || !validEmbedding(q.vector))) throw new Error("查詢向量或模型不相符。");
  const ranked = sources.flatMap(row => {
    if ((q.region && row.region !== q.region) || (q.category && row.category !== q.category) || (q.includeDemo === false && row.isDemo)) return [];
    const lexical = lexicalScore(q.query, `${row.title}\n${row.content}`);
    let score = lexical;
    if (semantic) {
      if (row.model !== EMBEDDING_MODEL || !validEmbedding(row.embedding)) return [];
      const similarity = cosine(q.vector!, row.embedding);
      if (similarity < .84) return [];
      score = similarity * .98 + lexical * .02;
    } else if (lexical < .35) return [];
    const { embedding, model, ...source } = row;
    return [{ ...source, score }];
  }).sort((a, b) => b.score - a.score);
  const counts = new Map<string, number>(); const results: SearchResult[] = [];
  for (const row of ranked) {
    if (semantic && row.score < ranked[0].score - .03) continue;
    if ((counts.get(row.documentId) ?? 0) >= 2) continue;
    counts.set(row.documentId, (counts.get(row.documentId) ?? 0) + 1); results.push(row);
    if (results.length === 6) break;
  }
  return results;
}
