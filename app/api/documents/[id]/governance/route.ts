import { z } from "zod";
import { ApiError, database, editor, handleError, jsonBody, requireEditor, response, validateChunks, type DbDocument } from "@/lib/server";
import { EMBEDDING_MODEL } from "@/lib/knowledge";
type Context = { params: Promise<{id: string}> };
const input = z.object({
  action: z.enum(["review", "withdraw"]), expectedUpdatedAt: z.string().min(1),
  accessLevel: z.enum(["public", "editor"]).default("editor"), aiAllowed: z.boolean().default(false),
  community: z.string().trim().max(200).default(""), culturalContext: z.string().trim().max(1000).default(""),
  reviewNote: z.string().trim().min(10).max(1500),
});
export async function GET(request: Request, context: Context) {
  try {
    if (!await editor(request)) throw new ApiError(401, "請先以編輯金鑰登入。");
    const {id} = await context.params;
    const row = await database().prepare("SELECT * FROM documents WHERE id=?").bind(id).first<DbDocument>();
    if (!row) throw new ApiError(404, "找不到成果。");
    const events = await database().prepare("SELECT id,action,actor,reason,snapshot,created_at AS createdAt FROM governance_events WHERE document_id=? ORDER BY created_at DESC LIMIT 100").bind(id).all();
    return response({ reviewNote: row.review_note, events: events.results });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    await requireEditor(request);
    const {id} = await context.params, db = database();
    const parsed = input.safeParse(await jsonBody(request, 10000));
    if (!parsed.success) throw new ApiError(400, "請填寫至少 10 字的審閱或撤回理由。");
    const d = parsed.data;
    const row = await db.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<DbDocument>();
    if (!row) throw new ApiError(404, "找不到成果。");
    if (row.is_demo) throw new ApiError(400, "示範素材不作為正式社群審閱紀錄。");
    if (row.updated_at !== d.expectedUpdatedAt) throw new ApiError(409, "成果已有新版本，請重新載入後審閱。");
    const withdraw = d.action === "withdraw";
    if (!withdraw && (!row.consent || d.community.length < 2 || d.culturalContext.length < 10)) throw new ApiError(400, "審閱前須確認同意，並填寫文化持有社群及脈絡與使用邊界。");
    if (!withdraw && d.accessLevel === "public" && d.aiAllowed) {
      const indexed = await db.prepare("SELECT content,embedding,model FROM chunks WHERE document_id=? ORDER BY position").bind(id).all<{content:string;embedding:string;model:string}>();
      if (indexed.results.some(c => c.model !== EMBEDDING_MODEL)) throw new ApiError(400, "索引模型不相符，請重建。");
      try { validateChunks(row.content, indexed.results.map(c=>({content:c.content,embedding:JSON.parse(c.embedding)})), EMBEDDING_MODEL); }
      catch { throw new ApiError(400, "尚無完整索引；請先依取得的 AI 許可編輯成果，勾選建立索引後重新審閱。"); }
    }
    const now = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString();
    const snapshot = JSON.stringify({before:row,decision:d});
    const results = await db.batch([
      db.prepare("UPDATE documents SET access_level=?,ai_allowed=?,review_state=?,community=?,cultural_context=?,review_note=?,status=?,consent=?,updated_at=? WHERE id=? AND updated_at=?")
        .bind(withdraw?"editor":d.accessLevel,!withdraw&&d.accessLevel==="public"&&d.aiAllowed?1:0,withdraw?"withdrawn":"approved",withdraw?row.community:d.community,withdraw?row.cultural_context:d.culturalContext,d.reviewNote,!withdraw&&d.accessLevel==="public"?"published":"draft",withdraw?0:row.consent,now,id,d.expectedUpdatedAt),
      db.prepare("INSERT INTO governance_events (id,document_id,action,actor,reason,snapshot,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM documents WHERE id=? AND updated_at=?)")
        .bind(crypto.randomUUID(),id,withdraw?"withdrawn":"reviewed","編輯（共用金鑰）",d.reviewNote,snapshot,now,id,now),
    ]);
    if (!results[0].meta.changes) throw new ApiError(409, "成果已有新版本，請重新載入。");
    return response({id,updatedAt:now});
  } catch (error) { return handleError(error); }
}
