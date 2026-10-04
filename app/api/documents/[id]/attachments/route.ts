import { ApiError, bucket, database, handleError, requireEditor, response, type DbDocument } from "@/lib/server";
import { requireDocumentAccess,actor } from "@/lib/server";
type Context = { params: Promise<{id: string}> };
export async function POST(request: Request, context: Context) {
  try {
    await requireEditor(request);
    if (Number(request.headers.get("content-length") ?? 0) > 10_600_000) throw new ApiError(413, "每個附件上限為 10 MB。");
    const { id } = await context.params;
    await requireDocumentAccess(request,id);
    const db = database();
    const row = await db.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<DbDocument>();
    if (!row) throw new ApiError(404, "找不到這份成果。");
    if (row.is_demo) throw new ApiError(400, "請另建正式成果，不可改動示範附件。");
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10_485_760) throw new ApiError(400, "請選擇 10 MB 以下的檔案。");
    const allowed = /\.(pdf|txt|md|docx|jpg|jpeg|png|webp|wav|mp3|mp4|m4a)$/i;
    if (!allowed.test(file.name)) throw new ApiError(400, "不支援此附件格式。");
    const count = await database().prepare("SELECT COUNT(*) AS n FROM attachments WHERE document_id=?").bind(id).first<{n: number}>();
    if ((count?.n ?? 0) >= 10) throw new ApiError(409, "每份成果最多 10 個附件。");
    const aid = crypto.randomUUID(), key = `${id}/${aid}`, filename = file.name.replace(/[\r\n\\/]/g, "_").slice(0, 150);
    await bucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: "application/octet-stream" } });
    const now = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString();
    try {
      const result = await db.batch([
        db.prepare("UPDATE documents SET submitted_at='',status='draft',review_state='pending',ai_allowed=0,review_note='',updated_at=? WHERE id=? AND updated_at=?").bind(now,id,row.updated_at),
        db.prepare("INSERT INTO attachments (id,document_id,filename,mime,size,object_key) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM documents WHERE id=? AND updated_at=?)").bind(aid,id,filename,file.type || "application/octet-stream",file.size,key,id,now),
        db.prepare("INSERT INTO governance_events (id,document_id,action,actor,reason,snapshot,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM documents WHERE id=? AND updated_at=?)").bind(crypto.randomUUID(),id,"attachment",await actor(request),"新增附件，重新審閱",JSON.stringify({before:row,attachment:{id:aid,filename,size:file.size}}),now,id,now),
      ]);
      if (!result[0].meta.changes) throw new ApiError(409, "成果已有新版本，請重新載入後上傳。");
    }
    catch (error) { await bucket().delete(key); throw error; }
    return response({ id: aid, filename, size: file.size, updatedAt:now }, 201);
  } catch (error) { return handleError(error); }
}
