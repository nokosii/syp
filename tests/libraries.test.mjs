import test from "node:test";
import assert from "node:assert/strict";
import {LIBRARIES,libraryContent} from "../lib/libraries.ts";
import {parseCSV,batchRecord} from "../lib/batch-import.ts";
test("Six libraries follow slide 26 and retain distinct editorial schemas",()=>{
 assert.deepEqual(LIBRARIES.map(l=>l.name),["生態環境庫","客家文化庫","地方記憶庫","產業技藝庫","公民新聞庫","人物故事庫"]);
 assert.equal(new Set(LIBRARIES.map(l=>l.layout)).size,6);
 assert.ok(LIBRARIES.every(l=>l.fields.length===5));
});
test("CSV keeps quoted multiline evidence, commas and escaped quotes",()=>{
 assert.deepEqual(parseCSV('\uFEFFtitle,content\r\n"報導,一","首行\n受訪者說""保留原文"""\r\n'),[{title:"報導,一",content:'首行\n受訪者說"保留原文"'}]);
 assert.throws(()=>parseCSV('a,a\n1,2'));assert.throws(()=>parseCSV('a,b\n1'));assert.throws(()=>parseCSV('a\n"unfinished'));
});
test("Batch imports preserve structured evidence and default to private unindexed drafts",()=>{
 const r=batchRecord({title:"測試",content:"原文","物種／植物名稱":"待辨識，不由 AI 定名"},"ecology","記錄者","課程","楊梅");
 assert.equal(r.consent,false);assert.equal(r.status,"draft");assert.equal(r.aiPreparation,false);assert.deepEqual(r.chunks,[]);
 assert.match(r.content,/待辨識/);assert.equal(r.libraryFields["物種／植物名稱"],"待辨識，不由 AI 定名");
 assert.equal(libraryContent("ecology",{"未定義欄位":"忽略"},"原文"),"原文");
});
