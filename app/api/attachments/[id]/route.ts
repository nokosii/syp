import { ApiError, bucket, database, editor, handleError } from "@/lib/server";
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    const { id } = await context.params;
    const row = await database().prepare("SELECT a.object_key,a.filename,d.status FROM attachments a JOIN documents d ON d.id=a.document_id WHERE a.id=?").bind(id).first<{object_key: string; filename: string; status: string}>();
    if (!row || row.status !== "published" && !await editor(request)) throw new ApiError(404, "找不到這個附件。");
    const file = await bucket().get(row.object_key);
    if (!file) throw new ApiError(404, "附件不存在。");
    return new Response(file.body, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return handleError(error); }
}
