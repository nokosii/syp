import { z } from "zod";
import { CATEGORIES, REGIONS, MAX_DOCUMENT_LENGTH, EMBEDDING_MODEL } from "@/lib/knowledge";
import { ApiError, database, documentFromRow, editor, handleError, jsonBody, requireEditor, response, validateChunks, type DbDocument } from "@/lib/server";

export const documentInput = z.object({
  title: z.string().trim().min(2).max(150), summary: z.string().trim().min(10).max(500),
  content: z.string().trim().min(30).max(MAX_DOCUMENT_LENGTH), region: z.enum(REGIONS), category: z.enum(CATEGORIES),
  author: z.string().trim().min(1).max(100), course: z.string().trim().max(150),
  recordedAt: z.string().refine(s => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  sourceUrl: z.string().max(1000).refine(s => s === "" || /^https?:\/\//.test(s) && URL.canParse(s)),
  license: z.enum(["僅供教學研究，引用請註明來源", "CC BY 4.0", "CC BY-NC 4.0", "保留所有權利"]),
  consent: z.boolean(), status: z.enum(["draft", "published"]),
  model: z.literal(EMBEDDING_MODEL), chunks: z.array(z.object({ content: z.string(), embedding: z.array(z.number()) })).max(90),
});
export async function GET(request: Request) {
  try {
    const isEditor = await editor(request);
    const url = new URL(request.url);
    const manage = url.searchParams.get("manage") === "1";
    if (manage && !isEditor) throw new ApiError(401, "請先以編輯金鑰登入。");
    const rows = await database().prepare(`SELECT d.*, (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) AS chunk_count FROM documents d ${manage ? "" : "WHERE d.status='published'"} ORDER BY d.created_at DESC LIMIT 500`).all<DbDocument>();
    return response({ documents: rows.results.map(row => documentFromRow(row)), model: EMBEDDING_MODEL });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    await requireEditor(request);
    const parsed = documentInput.safeParse(await jsonBody(request));
    if (!parsed.success) throw new ApiError(400, "請檢查必填欄位、內容長度及日期格式。");
    const d = parsed.data;
    if (d.status === "published" && !d.consent) throw new ApiError(400, "發布前請確認授權與受訪者同意。");
    validateChunks(d.content, d.chunks, d.model);
    const db = database();
    const count = await db.prepare("SELECT COUNT(*) AS n FROM chunks").first<{n: number}>();
    if ((count?.n ?? 0) + d.chunks.length > 2000) throw new ApiError(409, "索引容量已達第一版上限，請先擴充向量儲存服務。");
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO documents (id,title,summary,content,region,category,author,course,recorded_at,tags,source_url,license,consent,status,is_demo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id,d.title,d.summary,d.content,d.region,d.category,d.author,d.course,d.recordedAt,JSON.stringify(d.tags),d.sourceUrl,d.license,d.consent?1:0,d.status,0,now,now),
      ...d.chunks.map((c, i) => db.prepare("INSERT INTO chunks (id,document_id,position,content,embedding,model) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),id,i,c.content,JSON.stringify(c.embedding),d.model)),
    ]);
    return response({ id }, 201);
  } catch (error) { return handleError(error); }
}
