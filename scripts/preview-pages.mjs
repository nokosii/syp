import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };
createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/") { response.writeHead(302, { Location: "/syp/" }); response.end(); return; }
  const relative = pathname === "/syp/" ? "index.html" : pathname.startsWith("/syp/github-pages/") ? decodeURIComponent(pathname.slice(5)) : "";
  const target = path.resolve(root, relative);
  if (!relative || !target.startsWith(root) || relative.includes("..") || !types[path.extname(target)]) { response.writeHead(404); response.end(); return; }
  try { const content = await readFile(target); response.writeHead(200, { "Content-Type": types[path.extname(target)], "Cache-Control": "no-store" }); response.end(content); }
  catch { response.writeHead(404); response.end(); }
}).listen(4173, "127.0.0.1", () => console.log("Pages preview: http://127.0.0.1:4173/syp/"));
