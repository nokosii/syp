import { z } from "zod";
import { cosine, EMBEDDING_MODEL, lexicalScore, REGIONS, CATEGORIES, validEmbedding, type SearchResult } from "@/lib/knowledge";
import { ApiError, database, handleError, jsonBody, response } from "@/lib/server";
const input = z.object({ query: z.string().trim().min(2).max(500), vector: z.array(z.number()).optional(), model: z.string().optional(), region: z.enum(REGIONS).optional(), category: z.enum(CATEGORIES).optional(), includeDemo: z.boolean().default(true) });
type SearchRow = { id: string; document_id: string; title: string; content: string; position: number; region: string; category: string; author: string; is_demo: number; embedding: string; model: string };
export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await jsonBody(request, 30000));
    if (!parsed.success) throw new ApiError(400, "請輸入 2–500 字的問題。");
    const q = parsed.data, semantic = q.vector !== undefined;
    if (semantic && (q.model !== EMBEDDING_MODEL || !validEmbedding(q.vector))) throw new ApiError(400, "查詢向量或模型不相符。");
    const where = ["d.status='published'"]; const params: (string | number)[] = [];
    if (q.region) { where.push("d.region=?"); params.push(q.region); }
    if (q.category) { where.push("d.category=?"); params.push(q.category); }
    if (!q.includeDemo) where.push("d.is_demo=0");
    const data = await database().prepare(`SELECT c.id,c.document_id,c.content,c.position,c.embedding,c.model,d.title,d.region,d.category,d.author,d.is_demo FROM chunks c JOIN documents d ON d.id=c.document_id WHERE ${where.join(" AND ")} LIMIT 2001`).bind(...params).all<SearchRow>();
    if (data.results.length > 2000) throw new ApiError(503, "資料量超過第一版檢索容量，請聯繫管理員擴充索引。");
    const ranked = data.results.flatMap(row => {
      const lexical = lexicalScore(q.query, `${row.title}\n${row.content}`);
      let score = lexical;
      if (semantic) {
        if (row.model !== EMBEDDING_MODEL) return [];
        const vector = JSON.parse(row.embedding);
        if (!validEmbedding(vector)) return [];
        const similarity = cosine(q.vector!, vector);
        // E5 has a high similarity baseline. Calibrated against related Chinese
        // demo questions and an unrelated astronomy question; not a confidence probability.
        if (similarity < .84) return [];
        score = similarity * .98 + lexical * .02;
      } else if (lexical < .35) return [];
      return [{ id: row.id, documentId: row.document_id, title: row.title, content: row.content, position: row.position, region: row.region, category: row.category, author: row.author, isDemo: !!row.is_demo, score }];
    }).sort((a, b) => b.score - a.score);
    const counts = new Map<string, number>(); const results: SearchResult[] = [];
    for (const row of ranked) {
      if (semantic && row.score < ranked[0].score - .03) continue;
      if ((counts.get(row.documentId) ?? 0) >= 2) continue;
      counts.set(row.documentId, (counts.get(row.documentId) ?? 0) + 1); results.push(row);
      if (results.length === 6) break;
    }
    return response({ results, mode: semantic ? "semantic" : "keyword", model: semantic ? EMBEDDING_MODEL : null, totalCandidates: data.results.length });
  } catch (error) { return handleError(error); }
}
