import { build } from "vite";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
await build({ configFile: path.join(root, "static-site/vite.config.ts") });
const checking = process.argv.includes("--check");
const wanted = new Map([["index.html", await readFile(path.join(root, ".pages-dist/index.html"))], [".nojekyll", Buffer.alloc(0)]]);
async function collect(dir, relative = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await collect(path.join(dir, entry.name), name);
    else if (name !== "index.html") wanted.set(`github-pages/${name}`, await readFile(path.join(dir, entry.name)));
  }
}
await collect(path.join(root, ".pages-dist"));
// Remove only files listed in our previous build manifest; never arbitrary paths.
let previous = [];
try { previous = JSON.parse(await readFile(path.join(root, "github-pages/manifest.json"), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const manifest = [...wanted.keys()].filter(name => name.startsWith("github-pages/")).sort();
wanted.set("github-pages/manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
for (const [name, bytes] of wanted) {
  const target = path.join(root, name);
  if (checking) {
    const actual = await readFile(target).catch(() => null);
    if (!actual?.equals(bytes)) throw new Error(`Pages artifact differs: ${name}. Run npm run build:pages and commit the output.`);
  } else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
}
for (const name of previous) {
  if (typeof name !== "string" || !/^github-pages\/(assets\/[^/]+|[^/]+)$/.test(name) || name.includes("..")) throw new Error("Unsafe Pages manifest path");
  if (!wanted.has(name)) {
    if (checking) throw new Error(`Obsolete Pages artifact: ${name}`);
    await unlink(path.join(root, name)).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}
console.log(checking ? "Pages artifacts match the source." : "GitHub Pages files ready at index.html and github-pages/.");
