import { env } from "cloudflare:workers";
import { demoLibrary } from "./libraries";
import { demoGovernance } from "./governance";
import { chunkText, EMBEDDING_MODEL, validEmbedding, type KnowledgeDocument, type ChunkInput } from "./knowledge";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function database() {
  if (!env.DB) throw new ApiError(503, "資料庫暫時無法連線，請稍後重試。");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new ApiError(503, "檔案儲存空間暫時無法連線，請稍後重試。");
  return env.BUCKET;
}
async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function legacyEditor(request: Request) {
  const secret = env.EDITOR_KEY;
  if (!secret || secret.length < 32) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (bearer && equal(await digest(bearer), await digest(secret))) return true;
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)syp_editor=([^;]+)/)?.[1];
  if (!cookie) return false;
  const [expires, signature] = cookie.split(".");
  if (!signature || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return equal(signature, await digest(`${secret}:${expires}`));
}
export function sameOrigin(request: Request) {
  if (request.headers.get("authorization")) return;
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new ApiError(403, "請從本站操作。");
}
export async function requireEditor(request: Request) {
  sameOrigin(request);
  if (!await editor(request)) throw new ApiError(401, "請先登入並取得有效會員資格。");
}
export async function createSession(secret: string) {
  if (!env.EDITOR_KEY || secret.length > 200 || !equal(await digest(secret), await digest(env.EDITOR_KEY))) {
    throw new ApiError(401, "編輯金鑰不正確。");
  }
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  return `${expires}.${await digest(`${env.EDITOR_KEY}:${expires}`)}`;
}
export async function jsonBody(request: Request, limit = 1_200_000) {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ApiError(413, "資料過大，請縮短內容。");
  const body = await request.text();
  if (body.length > limit) throw new ApiError(413, "資料過大，請縮短內容。");
  try { return JSON.parse(body); } catch { throw new ApiError(400, "資料格式不正確。"); }
}
export function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function handleError(error: unknown) {
  if (error instanceof ApiError) return response({ error: error.message }, error.status);
  console.error("Knowledge API failure", error instanceof Error ? error.message : "Unknown error");
  return response({ error: "服務暫時無法使用。您輸入的內容仍保留，請稍後重試。" }, 503);
}
export type DbDocument = {
  library: string; library_fields:string; owner_id:string|null; submitted_at:string;
  access_level: "public" | "editor"; ai_allowed: number; review_state: "pending" | "approved" | "withdrawn";
  community: string; cultural_context: string; review_note: string;
  id: string; title: string; summary: string; content: string; region: string; category: string;
  author: string; course: string; recorded_at: string; tags: string; source_url: string; license: string;
  consent: number; status: "draft" | "published"; is_demo: number; created_at: string; updated_at: string; chunk_count?: number;
};
export function documentFromRow(row: DbDocument, content = false): KnowledgeDocument {
  return { library:row.is_demo?demoLibrary(row.id):row.library,libraryFields:JSON.parse(row.library_fields||"{}"),ownerId:undefined,submittedAt:row.submitted_at, governance: row.is_demo ? demoGovernance : { accessLevel: row.access_level, aiAllowed: !!row.ai_allowed, reviewState: row.review_state, community: row.community, culturalContext: row.cultural_context, reviewNote: "" }, id: row.id, title: row.title, summary: row.summary, ...(content ? { content: row.content } : {}),
    region: row.region, category: row.category, author: row.author, course: row.course, recordedAt: row.recorded_at,
    tags: JSON.parse(row.tags), sourceUrl: row.source_url, license: row.license, consent: !!row.consent,
    status: row.status, isDemo: !!row.is_demo, createdAt: row.created_at, updatedAt: row.updated_at, chunkCount: row.chunk_count };
}
export function validateChunks(content: string, chunks: ChunkInput[], model: string) {
  const expected = chunkText(content);
  if (model !== EMBEDDING_MODEL || !Array.isArray(chunks) || chunks.length !== expected.length || chunks.length > 90 ||
      chunks.some((c, i) => c.content !== expected[i] || !validEmbedding(c.embedding))) {
    throw new ApiError(400, "語意索引不完整，請重新建立後再儲存。");
  }
}

export type Member = {id:string;email:string;name:string;role:"teacher"|"reviewer"|"admin";state:"pending"|"active"|"suspended"};
export async function currentMember(request:Request):Promise<Member|null>{
 const id=request.headers.get("oai-authenticated-user-id"),email=request.headers.get("oai-authenticated-user-email");
 if(!id||!email)return null;
 if(env.OWNER_EMAIL&&email.toLowerCase()===env.OWNER_EMAIL.toLowerCase()){
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO members (id,email,name,role,state,created_at,updated_at) VALUES (?,?,?,'admin','active',?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,role='admin',state='active'").bind(id,email,email,now,now).run();
 }
 return database().prepare("SELECT id,email,name,role,state FROM members WHERE id=?").bind(id).first<Member>();
}
export async function editor(request:Request){if(await legacyEditor(request))return true;return (await currentMember(request))?.state==="active";}
export async function administrator(request:Request){if(await legacyEditor(request))return true;const m=await currentMember(request);return m?.state==="active"&&m.role==="admin";}
export async function reviewer(request:Request){if(await administrator(request))return true;const m=await currentMember(request);return m?.state==="active"&&m.role==="reviewer";}
export async function actor(request:Request){const m=await currentMember(request);return m?.state==="active"?`${m.name} (${m.id})`:"管理員（維護金鑰）";}
export async function documentAccess(request:Request,id:string){
 if(await reviewer(request))return true;
 const m=await currentMember(request);if(m?.state!=="active")return false;
 return !!await database().prepare("SELECT id FROM documents WHERE id=? AND (owner_id=? OR EXISTS(SELECT 1 FROM collaborators WHERE document_id=documents.id AND member_id=?))").bind(id,m.id,m.id).first();
}
export async function requireDocumentAccess(request:Request,id:string){sameOrigin(request);if(!await documentAccess(request,id))throw new ApiError(403,"您不是這份成果的共同編輯者。");}
export async function requireReviewer(request:Request){sameOrigin(request);if(!await editor(request))throw new ApiError(401,"請先登入。");if(!await reviewer(request))throw new ApiError(403,"這項操作需要審閱者或管理員權限。");}
