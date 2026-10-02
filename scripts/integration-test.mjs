import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error("Integration mutations are restricted to a local test server.");
const key = readFileSync(".local-editor-key.txt", "utf8").trim();
const index = JSON.parse(readFileSync("lib/demo-index.json", "utf8"));
const queries = JSON.parse(readFileSync("tests/semantic-queries.json", "utf8"));
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
let checks = 0, id;
const request = async (path, options = {}) => {
  const response = await fetch(base + path, options);
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = {error: text}; }
  return { status: response.status, data, response };
};
function check(condition, message) { assert.ok(condition, message); console.log(`PASS ${message}`); checks++; }
try {
  let r = await request("/api/demo", { method: "POST", headers });
  check(r.status === 200 && r.data.inserted === 0, "Demo initialization is idempotent");
  r = await request("/api/documents");
  check(r.status === 200 && r.data.documents.length >= 6, "Published documents persist in D1");
  r = await request("/api/documents?manage=1");
  check(r.status === 401, "Anonymous visitors cannot view management listing");
  r = await request("/api/documents", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: "{}" });
  check(r.status === 401, "Anonymous visitors cannot write documents");
  r = await request("/api/session", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: JSON.stringify({ key }) });
  check(r.status === 403, "Cross-origin editor login is rejected");
  r = await request("/api/session", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ key }) });
  const cookie = r.response.headers.get("set-cookie");
  check(r.status === 200 && /HttpOnly/.test(cookie) && /SameSite=Strict/.test(cookie), "Editor login issues an HttpOnly SameSite cookie");
  r = await request("/api/session", { headers: { Cookie: cookie.split(";")[0] } });
  check(r.data.editor === true, "Signed editor session works");
  const fixture = { ...index.documents[0], title: "LOCAL TEST ONLY – draft visibility", author: "Local integration fixture", status: "draft", model: index.model, consent: false };
  r = await request("/api/documents", { method: "POST", headers, body: JSON.stringify({ ...fixture, status: "published" }) });
  check(r.status === 400, "Publishing requires explicit consent");
  r = await request("/api/documents", { method: "POST", headers, body: JSON.stringify({...fixture, recordedAt:"2026-02-30"}) });
  check(r.status === 400, "Invalid calendar dates are rejected");
  r = await request("/api/documents", { method: "POST", headers, body: JSON.stringify({...fixture, chunks:[{...fixture.chunks[0], content:"tampered text"},fixture.chunks[1]]}) });
  check(r.status === 400, "Mismatched source chunks cannot be indexed");
  r = await request("/api/documents", { method: "POST", headers, body: JSON.stringify(fixture) });
  id = r.data.id;
  check(r.status === 201 && !!id, "Draft and validated vectors are saved atomically");
  r = await request(`/api/documents/${id}`);
  check(r.status === 404, "Draft detail is hidden from visitors");
  r = await request(`/api/documents/${id}`, { headers });
  check(r.status === 200 && r.data.content === fixture.content && !r.data.isDemo, "Editor reads complete original and cannot set demo flag");
  r = await request("/api/documents");
  check(!r.data.documents.some(d => d.id === id), "Draft is absent from published listing");
  const form = new FormData(); form.append("file", new File(["Local attachment QA – original text."], "original.txt", { type: "text/plain" }));
  r = await request(`/api/documents/${id}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const attachmentId = r.data.id;
  check(r.status === 201 && attachmentId, "Original attachment is saved in R2 with metadata in D1");
  const hidden = await fetch(base + `/api/attachments/${attachmentId}`);
  check(hidden.status === 404, "Draft attachment is protected from anonymous download");
  const download = await fetch(base + `/api/attachments/${attachmentId}`, { headers: {Authorization:`Bearer ${key}`} });
  check(download.status === 200 && (await download.text()).includes("Local attachment QA") && /attachment/.test(download.headers.get("content-disposition")), "Authorized original attachment downloads safely");
  r = await request(`/api/documents/${id}`, { method:"PUT",headers,body:JSON.stringify({...fixture,consent:true,status:"published"}) });
  check(r.status === 200, "Editor can publish an approved draft");
  r = await request(`/api/documents/${id}`);
  check(r.status === 200 && r.data.status === "published", "Published original is now visible");
  // Remove fixture before semantic ranking so it does not compete with demos.
  r = await request(`/api/documents/${id}`, { method:"DELETE",headers }); id = undefined;
  check(r.status === 200, "Delete removes local test document");
  const removed = await fetch(base + `/api/attachments/${attachmentId}`, {headers:{Authorization:`Bearer ${key}`}});
  check(removed.status === 404, "Deletion removes attachment metadata and bytes");
  for (const [i, expected] of [[0,"demo-coast"],[1,"demo-river"],[2,"demo-language"]]) {
    const q = queries[i];
    r = await request("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(q)});
    check(r.status === 200 && r.data.mode === "semantic" && r.data.results[0]?.documentId === expected, `Semantic paraphrase ${i + 1} retrieves correct Chinese source`);
  }
  const unrelated = queries[3];
  r = await request("/api/search", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(unrelated) });
  check(r.status === 200 && r.data.results.length === 0, "Unrelated astronomy question returns no evidence");
  r = await request("/api/search", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...unrelated,vector:[1,2,3]}) });
  check(r.status === 400, "Wrong vector dimensions are rejected");
  r = await request("/api/search", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...unrelated,query:"水環境",vector:undefined,model:undefined,includeDemo:false}) });
  check(r.status === 200 && r.data.results.length === 0, "Readers can exclude demonstration records");
  r = await request("/api/search", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:"水環境",region:"平鎮"}) });
  check(r.status === 200 && r.data.mode === "keyword" && r.data.results.every(x => x.region === "平鎮"), "Keyword fallback respects region filters");
  console.log(`\n${checks} integration checks passed.`);
} finally {
  if (id) await request(`/api/documents/${id}`, {method:"DELETE",headers});
}
