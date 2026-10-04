import { EMBEDDING_MODEL } from "./knowledge.ts";
import { libraryById,libraryContent } from "./libraries.ts";
export function parseCSV(text:string){
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(!cell)quoted=true;else throw new Error("CSV 引號位置不正確。");}else if(c===","&&!quoted){row.push(cell);cell="";}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";}else cell+=c;}
 if(quoted)throw new Error("CSV 引號未結束。");row.push(cell);if(row.some(Boolean))rows.push(row);const header=rows.shift()?.map(v=>v.replace(/^\uFEFF/,""));if(!header?.length||new Set(header).size!==header.length)throw new Error("CSV 欄名需唯一。");
 return rows.map((r,i)=>{if(r.length!==header.length)throw new Error(`CSV 第 ${i+2} 列欄位數不一致。`);return Object.fromEntries(header.map((k,j)=>[k,r[j]]));});
}
export function batchRecord(v:Record<string,unknown>,library:string,author:string,course:string,region:string){
 const spec=libraryById(library),fields=Object.fromEntries(spec.fields.map(k=>[k,String((v.libraryFields as Record<string,string>|undefined)?.[k]??v[k]??"")]));
 const text=String(v.content??"");
 return {title:String(v.title??""),summary:String(v.summary??text.slice(0,180)),content:libraryContent(library,fields,text),library,libraryFields:fields,author:String(v.author||author),course:String(v.course||course),region:String(v.region??region),category:String(v.category??"田野紀錄"),recordedAt:String(v.recordedAt??""),tags:Array.isArray(v.tags)?v.tags:String(v.tags??"").split(/[,，、]/).filter(Boolean),sourceUrl:String(v.sourceUrl??""),license:String(v.license??"保留所有權利"),consent:v.consent===true||v.consent==="true",status:"draft",aiPreparation:false,model:EMBEDDING_MODEL,chunks:[]};
}
