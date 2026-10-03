import index from "./demo-index.json" with { type: "json" };
import { EMBEDDING_MODEL, type KnowledgeDocument } from "./knowledge.ts";
import { retrieve, type IndexedSource, type RetrievalQuery } from "./retrieval.ts";
import { demoGovernance } from "./governance.ts";

// Only the original examples already public in Git are included. Private D1
// records, drafts, attachments and editor credentials never enter this bundle.
const published = index.documents.filter(d => d.status === "published" && d.consent);
const sources: IndexedSource[] = published.flatMap(d => d.chunks.map((chunk, position) => ({
  id: `${d.id}-${position}`, documentId: d.id, title: d.title, content: chunk.content,
  position, region: d.region, category: d.category, author: d.author,
  isDemo: d.isDemo, embedding: chunk.embedding, model: index.model,
})));
function documentView(d: typeof published[number]): KnowledgeDocument {
  const { chunks, ...document } = d;
  return { ...document, governance: demoGovernance, status: "published", chunkCount: chunks.length, attachments: [] };
}
export async function publicApi(path: string, options?: RequestInit): Promise<unknown> {
  const url = new URL(path, "https://public-snapshot.invalid");
  const method = options?.method ?? "GET";
  if (url.pathname === "/api/session" && method === "GET") return { editor: false };
  if (url.pathname === "/api/search" && method === "POST") {
    const q = JSON.parse(String(options?.body ?? "{}")) as RetrievalQuery;
    if (typeof q.query !== "string" || q.query.trim().length < 2 || q.query.trim().length > 500) throw new Error("請輸入 2–500 字的問題。");
    const results = retrieve(sources, { ...q, query: q.query.trim() });
    return { results, mode: q.vector ? "semantic" : "keyword", model: q.vector ? EMBEDDING_MODEL : null };
  }
  if (method !== "GET" || url.searchParams.get("manage") === "1") throw new Error("請前往主系統登入，收錄及管理成果。");
  if (url.pathname === "/api/documents") return { documents: published.map(documentView), model: EMBEDDING_MODEL };
  const match = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (match) {
    const d = published.find(d => d.id === decodeURIComponent(match[1]));
    if (d) return documentView(d);
    throw new Error("這份紀錄未包含在公開展示版，請前往主系統查看。");
  }
  throw new Error("公開展示版不提供這項操作，請前往主系統。");
}
