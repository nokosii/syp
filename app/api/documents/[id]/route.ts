import { ApiError, bucket, database, documentFromRow, editor, handleError, jsonBody, requireEditor, response, validateChunks, type DbDocument } from "@/lib/server";
import { documentInput } from "../route";
import { documentAccess,requireDocumentAccess,requireReviewer,reviewer,actor } from "@/lib/server";
import { canRead } from "@/lib/governance";
type Context = { params: Promise<{id: string}> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const row = await database().prepare("SELECT d.*, (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) AS chunk_count FROM documents d WHERE d.id=?").bind(id).first<DbDocument>();
    if (!row || (!canRead(documentFromRow(row)) && !await documentAccess(request,id))) throw new ApiError(404, "找不到這份成果。");
    const files = await database().prepare("SELECT id,filename,mime,size FROM attachments WHERE document_id=?").bind(id).all();
    return response({ ...documentFromRow(row, true), permissions:{edit:await documentAccess(request,id),review:await reviewer(request)},attachments: files.results });
  } catch (error) { return handleError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    await requireEditor(request);
    const { id } = await context.params;
    await requireDocumentAccess(request,id);
    const parsed = documentInput.safeParse(await jsonBody(request));
    if (!parsed.success) throw new ApiError(400, "請檢查必填欄位與內容格式。");
    const d = parsed.data, db = database();
    const row = await db.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<DbDocument>();
    if (!row) throw new ApiError(404, "找不到這份成果。");
    if (row.is_demo) throw new ApiError(400, "示範資料請另建成果，避免與真實紀錄混淆。");
    if (d.expectedUpdatedAt !== row.updated_at) throw new ApiError(409, "資料已更新，請重新載入後編輯。");
    if (d.status === "published") throw new ApiError(400, "修訂後請存為草稿並重新審閱。");
    if (d.aiPreparation) validateChunks(d.content, d.chunks, d.model);
    else if (d.chunks.length) throw new ApiError(400, "未允許 AI 處理時不得提交向量索引。");
    const count = await db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE document_id<>?").bind(id).first<{n: number}>();
    if ((count?.n ?? 0) + d.chunks.length > 2000) throw new ApiError(409, "索引容量已達第一版上限。");
    const now = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString();
    const result = await db.batch([
      db.prepare("UPDATE documents SET library=?,library_fields=?,submitted_at='',title=?,summary=?,content=?,region=?,category=?,author=?,course=?,recorded_at=?,tags=?,source_url=?,license=?,consent=?,status='draft',review_state='pending',ai_allowed=0,review_note='',updated_at=? WHERE id=? AND updated_at=?")
        .bind(d.library,JSON.stringify(d.libraryFields),d.title,d.summary,d.content,d.region,d.category,d.author,d.course,d.recordedAt,JSON.stringify(d.tags),d.sourceUrl,d.license,d.consent?1:0,now,id,d.expectedUpdatedAt),
      db.prepare("DELETE FROM chunks WHERE document_id=? AND EXISTS (SELECT 1 FROM documents WHERE id=? AND updated_at=?)").bind(id,id,now),
      ...d.chunks.map((c, i) => db.prepare("INSERT INTO chunks (id,document_id,position,content,embedding,model) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM documents WHERE id=? AND updated_at=?)").bind(crypto.randomUUID(),id,i,c.content,JSON.stringify(c.embedding),d.model,id,now)),
      db.prepare("INSERT INTO governance_events (id,document_id,action,actor,reason,snapshot,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM documents WHERE id=? AND updated_at=?)").bind(crypto.randomUUID(),id,"revised",await actor(request),"修訂原文，審閱及 AI 許可重設；快照為修訂前版本",JSON.stringify(row),now,id,now),
    ]);
    if (!result[0].meta.changes) throw new ApiError(409, "資料已更新，請重新載入。");
    return response({ id, updatedAt: now });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await requireEditor(request);
    await requireReviewer(request);
    const { id } = await context.params, db = database();
    const files = await db.prepare("SELECT object_key FROM attachments WHERE document_id=?").bind(id).all<{object_key: string}>();
    if (files.results.length) await bucket().delete(files.results.map(f => f.object_key));
    const result = await db.prepare("DELETE FROM documents WHERE id=?").bind(id).run();
    if (!result.meta.changes) throw new ApiError(404, "找不到這份成果。");
    return response({ deleted: true });
  } catch (error) { return handleError(error); }
}
