import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = ".sites-runtime/wrangler-local.json";
mkdirSync(".sites-runtime",{recursive:true});
writeFileSync(config, JSON.stringify({name:"syp-local",compatibility_date:"2026-05-15",d1_databases:[{binding:"DB",database_name:"site-creator-d1",database_id:"00000000-0000-4000-8000-000000000000"}]}));
if (!existsSync(".dev.vars")) {
  const key = randomBytes(32).toString("hex");
  writeFileSync(".dev.vars",`EDITOR_KEY=${key}\n`);
  writeFileSync(".local-editor-key.txt",`${key}\n`);
}
const wrangler = "node_modules/wrangler/bin/wrangler.js";
const args = [wrangler,"d1","execute","DB","--local","--config",config,"--persist-to",".wrangler/state"];
// Bootstrap only. Sites production migrations are managed independently.
const probe = spawnSync(process.execPath,[...args,"--command","SELECT id FROM documents LIMIT 1"],{encoding:"utf8",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
if (probe.status !== 0) {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
  for (const entry of journal.entries) {
    const result = spawnSync(process.execPath,[...args,"--file",`drizzle/${entry.tag}.sql`],{stdio:"inherit",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} else {
  // Earlier local previews bootstrapped migration 0000 without a migration
  // ledger. Upgrade that known schema once; hosted history is untouched.
  const governance = spawnSync(process.execPath,[...args,"--command","SELECT access_level FROM documents LIMIT 1"],{encoding:"utf8",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
  if (governance.status !== 0) {
    const result = spawnSync(process.execPath,[...args,"--file","drizzle/0001_strange_patriot.sql"],{stdio:"inherit",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  const membership = spawnSync(process.execPath,[...args,"--command","SELECT library FROM documents LIMIT 1"],{encoding:"utf8",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
  if(membership.status!==0){const result=spawnSync(process.execPath,[...args,"--file","drizzle/0002_conscious_scream.sql"],{stdio:"inherit",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});if(result.status!==0)process.exit(result.status??1);}
}
console.log("Local database is ready. The editor key is in .local-editor-key.txt (never commit it). Run npm run dev.");
