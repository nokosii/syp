import { z } from "zod";
import { documentInput } from "../route";
import { ApiError, actor, currentMember, database, handleError, jsonBody, requireEditor, response } from "@/lib/server";
export async function POST(request:Request){try{
 await requireEditor(request);const body=await jsonBody(request,900000);
 if(!Array.isArray(body.records)||!body.records.length||body.records.length>30||typeof body.requestId!=="string"||!/^[-a-zA-Z0-9]{10,80}$/.test(body.requestId))throw new ApiError(400,"一次可匯入 1–30 筆，請使用有效的批次識別碼。");
 const records:z.infer<typeof documentInput>[]=body.records.map((v:unknown,i:number)=>{const p=documentInput.safeParse(v);if(!p.success)throw new ApiError(400,`第 ${i+1} 筆欄位格式不正確。`);if(p.data.status!=="draft"||p.data.aiPreparation||p.data.chunks.length)throw new ApiError(400,"批次資料只存為未建立 AI 索引的草稿。");return p.data;});
 const member=await currentMember(request),key=`${member?.id??"maintenance"}:${body.requestId}`,payload=JSON.stringify(records);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload))),b=>b.toString(16).padStart(2,"0")).join("");
 const db=database();const previous=await db.prepare("SELECT fingerprint,result FROM imports WHERE id=?").bind(key).first<{fingerprint:string;result:string}>();
 if(previous){if(previous.fingerprint!==hash)throw new ApiError(409,"此批次識別碼已用於不同內容。");return response({documents:JSON.parse(previous.result),replayed:true});}
 const now=new Date().toISOString(),who=await actor(request),result=records.map(()=>({id:crypto.randomUUID(),updatedAt:now}));
 const statements=records.flatMap((d,i)=>[
 db.prepare("INSERT INTO documents(id,title,summary,content,region,category,author,course,recorded_at,tags,source_url,license,consent,status,is_demo,created_at,updated_at,library,library_fields,owner_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',0,?,?,?,?,?)").bind(result[i].id,d.title,d.summary,d.content,d.region,d.category,d.author,d.course,d.recordedAt,JSON.stringify(d.tags),d.sourceUrl,d.license,d.consent?1:0,now,now,d.library,JSON.stringify(d.libraryFields),member?.id??null),
 db.prepare("INSERT INTO governance_events(id,document_id,action,actor,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),result[i].id,"created",who,"批次建立草稿；待核對及送審",JSON.stringify({...d,chunks:undefined}),now),
 ]);
 statements.push(db.prepare("INSERT INTO imports(id,fingerprint,result,created_at) VALUES(?,?,?,?)").bind(key,hash,JSON.stringify(result),now));
 try{await db.batch(statements);}catch(e){const retry=await db.prepare("SELECT fingerprint,result FROM imports WHERE id=?").bind(key).first<{fingerprint:string;result:string}>();if(retry?.fingerprint===hash)return response({documents:JSON.parse(retry.result),replayed:true});throw e;}
 return response({documents:result},201);
}catch(e){return handleError(e);}}
