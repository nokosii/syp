import { ApiError, bucket, database, handleError, requireEditor, response } from "@/lib/server";
type Context = { params: Promise<{id: string}> };
export async function POST(request: Request, context: Context) {
  try {
    await requireEditor(request);
    if (Number(request.headers.get("content-length") ?? 0) > 10_600_000) throw new ApiError(413, "每個附件上限為 10 MB。");
    const { id } = await context.params;
    if (!await database().prepare("SELECT id FROM documents WHERE id=?").bind(id).first()) throw new ApiError(404, "找不到這份成果。");
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10_485_760) throw new ApiError(400, "請選擇 10 MB 以下的檔案。");
    const allowed = /\.(pdf|txt|md|docx|jpg|jpeg|png|webp|wav|mp3|mp4|m4a)$/i;
    if (!allowed.test(file.name)) throw new ApiError(400, "不支援此附件格式。");
    const count = await database().prepare("SELECT COUNT(*) AS n FROM attachments WHERE document_id=?").bind(id).first<{n: number}>();
    if ((count?.n ?? 0) >= 10) throw new ApiError(409, "每份成果最多 10 個附件。");
    const aid = crypto.randomUUID(), key = `${id}/${aid}`, filename = file.name.replace(/[\r\n\\/]/g, "_").slice(0, 150);
    await bucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: "application/octet-stream" } });
    try { await database().prepare("INSERT INTO attachments (id,document_id,filename,mime,size,object_key) VALUES (?,?,?,?,?,?)").bind(aid,id,filename,file.type || "application/octet-stream",file.size,key).run(); }
    catch (error) { await bucket().delete(key); throw error; }
    return response({ id: aid, filename, size: file.size }, 201);
  } catch (error) { return handleError(error); }
}
