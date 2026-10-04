import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=process.env.TEST_BASE_URL||"http://127.0.0.1:5174";
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error("Only local disposable test data is permitted.");
const key=readFileSync(".local-editor-key.txt","utf8").trim();
const admin={Authorization:`Bearer ${key}`,"Content-Type":"application/json",Origin:base};
const token=crypto.randomUUID(),ids=[],identities=[];let checks=0;
const headers=(id)=>({"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`,Origin:base,"Content-Type":"application/json"});
async function call(path,method="GET",h={},body){
 for(let attempt=0;attempt<3;attempt++){
  let r;try{r=await fetch(base+path,{signal:AbortSignal.timeout(5000),method,headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})});}catch(e){if(attempt<2)continue;throw new Error(`Local request timeout: ${method} ${path}`,{cause:e});}const text=await r.text();
  // Wrangler's local module watcher can interrupt a cold request before it reaches the API.
  if(r.status===503&&text.startsWith("Your worker restarted")&&attempt<2)continue;
  return {status:r.status,data:JSON.parse(text)};
 }
}
function check(v,message){assert.ok(v,message);console.log("PASS",message);checks++;}
try{
 const alice=`teacher-a-${token}`,bob=`teacher-b-${token}`,expert=`reviewer-${token}`;identities.push(alice,bob,expert);
 let r=await call("/api/members","POST",{...headers(alice),Origin:"https://attacker.example"},{name:"本機測試"});check(r.status===403,"Cross-origin membership requests blocked");
 for(const id of identities){r=await call("/api/members","POST",headers(id),{name:id});check(r.status===200&&r.data.member.state==="pending","Registration cannot self-approve");}
 const fixture={title:"本機共筆測試",summary:"僅供本機驗證的共筆草稿資料。",content:"這是本機共筆權限與版本衝突測試資料，不代表任何真實人物或地方調查成果。",region:"楊梅",category:"田野紀錄",author:"本機測試者",course:"測試",recordedAt:"",tags:[],sourceUrl:"",license:"保留所有權利",consent:false,status:"draft",library:"memory",libraryFields:{"年代與時間軸":"測試年代"},model:"Xenova/multilingual-e5-small",chunks:[],aiPreparation:false};
 r=await call("/api/documents","POST",headers(alice),fixture);check(r.status===401,"Pending members cannot write");
 r=await call("/api/members","PATCH",headers(alice),{id:alice,role:"teacher",state:"active"});check(r.status===403,"Members cannot grant their own role");
 for(const id of identities){r=await call("/api/members","PATCH",admin,{id,role:id===expert?"reviewer":"teacher",state:"active"});check(r.status===200,"Admin approves individual member");}
 r=await call("/api/members","GET",headers(alice));check(r.data.members.length===0,"Teacher cannot list private member directory");
 r=await call("/api/documents","POST",headers(alice),fixture);const id=r.data.id;ids.push(id);check(r.status===201&&id,"Teacher creates private owned draft");
 const owner=(await call(`/api/documents/${id}`,"GET",headers(alice))).data;check(owner.library==="memory"&&owner.libraryFields["年代與時間軸"]==="測試年代","Library schema round trips in D1");
 r=await call(`/api/documents/${id}`,"GET",headers(bob));check(r.status===404,"Uninvited teacher cannot read another draft");
 r=await call("/api/documents?manage=1","GET",headers(bob));check(!r.data.documents.some(d=>d.id===id),"Management list respects ownership");
 r=await call(`/api/documents/${id}/governance`,"GET",headers(bob));check(r.status===403,"Private version history respects document scope");
 r=await call(`/api/documents/${id}`,"PUT",headers(bob),{...fixture,expectedUpdatedAt:owner.updatedAt});check(r.status===403,"Uninvited teacher cannot edit");
 r=await call(`/api/documents/${id}/collaboration`,"POST",headers(alice),{action:"invite",email:`${bob}@example.test`});check(r.status===200,"Owner adds an approved coauthor");
 r=await call(`/api/documents/${id}`,"GET",headers(bob));check(r.status===200,"Invited coauthor reads draft");
 r=await call(`/api/documents/${id}/collaboration`,"POST",headers(bob),{action:"invite",email:`${expert}@example.test`});check(r.status===403,"Coauthor cannot widen document access");
 const writes=await Promise.all([call(`/api/documents/${id}`,"PUT",headers(alice),{...fixture,title:"修訂 A",expectedUpdatedAt:owner.updatedAt}),call(`/api/documents/${id}`,"PUT",headers(bob),{...fixture,title:"修訂 B",expectedUpdatedAt:owner.updatedAt})]);check(writes.filter(r=>r.status===200).length===1&&writes.filter(r=>r.status===409).length===1,"Concurrent edits cannot silently overwrite");
 r=await call(`/api/documents/${id}/collaboration`,"POST",headers(bob),{action:"comment",content:"本機查核討論與待補證據"});check(r.status===200,"Coauthor discussion persists");
 r=await call(`/api/documents/${id}/collaboration`,"GET",headers(alice));check(r.data.comments.some(c=>c.actor.includes(bob)),"Comments retain individual attribution");
 const latest=(await call(`/api/documents/${id}`,"GET",headers(alice))).data;
 r=await call(`/api/documents/${id}/collaboration`,"POST",headers(alice),{action:"submit",expectedUpdatedAt:latest.updatedAt});check(r.status===200,"Teacher submits version for expert review");
 const v=(await call(`/api/documents/${id}`,"GET",headers(alice))).data;
 r=await call(`/api/documents/${id}/governance`,"PATCH",headers(alice),{action:"review",expectedUpdatedAt:v.updatedAt,reviewNote:"不允許教师自行核准發布成果",community:"測試",culturalContext:"本機測試文化脈絡",accessLevel:"public"});check(r.status===403,"Teacher cannot self-publish through review API");
 r=await call(`/api/documents/${id}/governance`,"GET",headers(expert));check(r.status===200&&r.data.events.some(e=>e.actor.includes(alice)),"Reviewer reads attributed governance history");
 const form=new FormData();form.append("file",new File(["local fixture"],"test.txt"));const ah={...headers(alice)};delete ah["Content-Type"];
 const f=await fetch(base+`/api/documents/${id}/attachments`,{method:"POST",headers:ah,body:form});const aid=(await f.json()).id;check(f.status===201,"Owner uploads original file");
 await call(`/api/documents/${id}/collaboration`,"POST",headers(alice),{action:"remove",email:`${bob}@example.test`});
 r=await call(`/api/attachments/${aid}`,"GET",headers(bob));check(r.status===404,"Revoked coauthor loses file access");
 const batch={requestId:crypto.randomUUID(),records:[{...fixture,library:"craft"},{...fixture,library:"news"}]};
 r=await call("/api/documents/batch","POST",headers(alice),batch);check(r.status===201&&r.data.documents.length===2,"Batch stores all validated drafts atomically");ids.push(...r.data.documents.map(d=>d.id));const first=r.data.documents;
 r=await call("/api/documents/batch","POST",headers(alice),batch);check(r.status===200&&r.data.replayed&&JSON.stringify(r.data.documents)===JSON.stringify(first),"Retried batch does not duplicate documents");
 r=await call("/api/documents/batch","POST",headers(alice),{...batch,records:[{...fixture,title:"不同內容"}]});check(r.status===409,"Batch key cannot be reused for changed payload");
 const before=(await call("/api/documents?manage=1","GET",headers(alice))).data.documents.length;
 r=await call("/api/documents/batch","POST",headers(alice),{requestId:crypto.randomUUID(),records:[fixture,{...fixture,title:""}]});check(r.status===400,"Invalid batch row rejects whole batch");
 check((await call("/api/documents?manage=1","GET",headers(alice))).data.documents.length===before,"Invalid batch does not partially insert records");
 await call("/api/members","PATCH",admin,{id:alice,role:"teacher",state:"suspended"});
 r=await call(`/api/documents/${id}`,"GET",headers(alice));check(r.status===404,"Suspension immediately removes private data access");
 r=await call("/api/documents/batch","POST",headers(alice),{requestId:crypto.randomUUID(),records:[fixture]});check(r.status===401,"Suspension blocks new batch writes");
 console.log(`${checks} membership and collaboration checks passed.`);
}finally{for(const id of ids)if(id)await call(`/api/documents/${id}`,"DELETE",admin);for(const id of identities)await call("/api/members","PATCH",admin,{id,role:"teacher",state:"suspended"});}
