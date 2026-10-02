import { env } from "cloudflare:workers";
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
export async function editor(request: Request) {
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
  if (!await editor(request)) throw new ApiError(401, "請先以編輯金鑰登入。");
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
  id: string; title: string; summary: string; content: string; region: string; category: string;
  author: string; course: string; recorded_at: string; tags: string; source_url: string; license: string;
  consent: number; status: "draft" | "published"; is_demo: number; created_at: string; updated_at: string; chunk_count?: number;
};
export function documentFromRow(row: DbDocument, content = false): KnowledgeDocument {
  return { id: row.id, title: row.title, summary: row.summary, ...(content ? { content: row.content } : {}),
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
