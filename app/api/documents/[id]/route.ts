import { ApiError, bucket, database, documentFromRow, editor, handleError, jsonBody, requireEditor, response, validateChunks, type DbDocument } from "@/lib/server";
import { documentInput } from "../route";
type Context = { params: Promise<{id: string}> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const row = await database().prepare("SELECT * FROM documents WHERE id=?").bind(id).first<DbDocument>();
    if (!row || (row.status !== "published" && !await editor(request))) throw new ApiError(404, "找不到這份成果。");
    const files = await database().prepare("SELECT id,filename,mime,size FROM attachments WHERE document_id=?").bind(id).all();
    return response({ ...documentFromRow(row, true), attachments: files.results });
  } catch (error) { return handleError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    await requireEditor(request);
    const { id } = await context.params;
    const parsed = documentInput.safeParse(await jsonBody(request));
    if (!parsed.success) throw new ApiError(400, "請檢查必填欄位與內容格式。");
    const d = parsed.data, db = database();
    const row = await db.prepare("SELECT id,is_demo FROM documents WHERE id=?").bind(id).first<{id: string; is_demo: number}>();
    if (!row) throw new ApiError(404, "找不到這份成果。");
    if (row.is_demo) throw new ApiError(400, "示範資料請另建成果，避免與真實紀錄混淆。");
    if (d.status === "published" && !d.consent) throw new ApiError(400, "發布前請確認授權與受訪者同意。");
    validateChunks(d.content, d.chunks, d.model);
    const count = await db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE document_id<>?").bind(id).first<{n: number}>();
    if ((count?.n ?? 0) + d.chunks.length > 2000) throw new ApiError(409, "索引容量已達第一版上限。");
    await db.batch([
      db.prepare("UPDATE documents SET title=?,summary=?,content=?,region=?,category=?,author=?,course=?,recorded_at=?,tags=?,source_url=?,license=?,consent=?,status=?,updated_at=? WHERE id=?")
        .bind(d.title,d.summary,d.content,d.region,d.category,d.author,d.course,d.recordedAt,JSON.stringify(d.tags),d.sourceUrl,d.license,d.consent?1:0,d.status,new Date().toISOString(),id),
      db.prepare("DELETE FROM chunks WHERE document_id=?").bind(id),
      ...d.chunks.map((c, i) => db.prepare("INSERT INTO chunks (id,document_id,position,content,embedding,model) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),id,i,c.content,JSON.stringify(c.embedding),d.model)),
    ]);
    return response({ id });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await requireEditor(request);
    const { id } = await context.params, db = database();
    const files = await db.prepare("SELECT object_key FROM attachments WHERE document_id=?").bind(id).all<{object_key: string}>();
    if (files.results.length) await bucket().delete(files.results.map(f => f.object_key));
    const result = await db.prepare("DELETE FROM documents WHERE id=?").bind(id).run();
    if (!result.meta.changes) throw new ApiError(404, "找不到這份成果。");
    return response({ deleted: true });
  } catch (error) { return handleError(error); }
}
