import { z } from "zod";
import { EMBEDDING_MODEL, REGIONS, CATEGORIES, validEmbedding } from "@/lib/knowledge";
import { retrieve } from "@/lib/retrieval";
import { AI_SQL } from "@/lib/governance";
import { ApiError, database, handleError, jsonBody, response } from "@/lib/server";
const input = z.object({ query: z.string().trim().min(2).max(500), vector: z.array(z.number()).optional(), model: z.string().optional(), region: z.enum(REGIONS).optional(), category: z.enum(CATEGORIES).optional(), includeDemo: z.boolean().default(true) });
type SearchRow = { id: string; document_id: string; title: string; content: string; position: number; region: string; category: string; author: string; is_demo: number; embedding: string; model: string };
export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await jsonBody(request, 30000));
    if (!parsed.success) throw new ApiError(400, "請輸入 2–500 字的問題。");
    const q = parsed.data, semantic = q.vector !== undefined;
    if (semantic && (q.model !== EMBEDDING_MODEL || !validEmbedding(q.vector))) throw new ApiError(400, "查詢向量或模型不相符。");
    const where = [AI_SQL]; const params: (string | number)[] = [];
    if (q.region) { where.push("d.region=?"); params.push(q.region); }
    if (q.category) { where.push("d.category=?"); params.push(q.category); }
    if (!q.includeDemo) where.push("d.is_demo=0");
    const data = await database().prepare(`SELECT c.id,c.document_id,c.content,c.position,c.embedding,c.model,d.title,d.region,d.category,d.author,d.is_demo FROM chunks c JOIN documents d ON d.id=c.document_id WHERE ${where.join(" AND ")} LIMIT 2001`).bind(...params).all<SearchRow>();
    if (data.results.length > 2000) throw new ApiError(503, "資料量超過第一版檢索容量，請聯繫管理員擴充索引。");
    const results = retrieve(data.results.map(row => ({
      id: row.id, documentId: row.document_id, title: row.title, content: row.content,
      position: row.position, region: row.region, category: row.category, author: row.author,
      isDemo: !!row.is_demo, embedding: JSON.parse(row.embedding), model: row.model,
    })), q);
    return response({ results, mode: semantic ? "semantic" : "keyword", model: semantic ? EMBEDDING_MODEL : null, totalCandidates: data.results.length });
  } catch (error) { return handleError(error); }
}
