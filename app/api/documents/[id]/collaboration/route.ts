import { ApiError, actor, administrator, currentMember, database, documentAccess, handleError, jsonBody, requireDocumentAccess, response } from "@/lib/server";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{
 const {id}=await context.params;if(!await documentAccess(request,id))throw new ApiError(403,"僅共同編輯者可讀取討論。");
 const db=database();const comments=await db.prepare("SELECT id,actor,content,created_at AS createdAt FROM comments WHERE document_id=? ORDER BY created_at DESC LIMIT 100").bind(id).all();
 const people=await db.prepare("SELECT m.id,m.name,m.email FROM collaborators c JOIN members m ON m.id=c.member_id WHERE c.document_id=?").bind(id).all();
 const owner=await db.prepare("SELECT owner_id FROM documents WHERE id=?").bind(id).first<{owner_id:string|null}>();
 return response({comments:comments.results,collaborators:people.results,canInvite:await administrator(request)||(await currentMember(request))?.id===owner?.owner_id});
}catch(e){return handleError(e);}}
export async function POST(request:Request,context:Context){try{
 const {id}=await context.params;await requireDocumentAccess(request,id);const db=database(),d=await jsonBody(request,5000),now=new Date().toISOString();
 const row=await db.prepare("SELECT owner_id,is_demo,updated_at FROM documents WHERE id=?").bind(id).first<{owner_id:string|null;is_demo:number;updated_at:string}>();
 if(!row||row.is_demo)throw new ApiError(400,"請另建正式成果。");
 if(d.action==="comment"){
  if(typeof d.content!=="string"||!d.content.trim()||d.content.length>2000)throw new ApiError(400,"討論需為 1–2,000 字。");
  await db.prepare("INSERT INTO comments(id,document_id,actor,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),id,await actor(request),d.content.trim(),now).run();
 }else if(d.action==="invite"||d.action==="remove"){
  if(!await administrator(request)&&(await currentMember(request))?.id!==row.owner_id)throw new ApiError(403,"只有建立者或管理員可設定共同編輯者。");
  const m=typeof d.email==="string"?await db.prepare("SELECT id FROM members WHERE lower(email)=lower(?) AND state='active' LIMIT 1").bind(d.email.trim()).first<{id:string}>():null;
  if(!m)throw new ApiError(400,"請填寫已核准會員的 email。");
  if(d.action==="remove")await db.prepare("DELETE FROM collaborators WHERE document_id=? AND member_id=?").bind(id,m.id).run();
  else await db.prepare("INSERT INTO collaborators(id,document_id,member_id) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM collaborators WHERE document_id=? AND member_id=?)").bind(crypto.randomUUID(),id,m.id,id,m.id).run();
  await db.prepare("INSERT INTO governance_events(id,document_id,action,actor,reason,snapshot,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,d.action,await actor(request),d.action==="invite"?"加入共同編輯者":"移除共同編輯者",JSON.stringify({memberId:m.id}),now).run();
 }else if(d.action==="submit"){
  if(d.expectedUpdatedAt!==row.updated_at)throw new ApiError(409,"已有新版本，請重新載入。");
  const version=new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString();
  const result=await db.batch([
   db.prepare("UPDATE documents SET submitted_at=?,updated_at=? WHERE id=? AND updated_at=?").bind(version,version,id,row.updated_at),
   db.prepare("INSERT INTO governance_events(id,document_id,action,actor,reason,snapshot,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM documents WHERE id=? AND updated_at=?)").bind(crypto.randomUUID(),id,"submitted",await actor(request),"提交教師／地方專家審閱",JSON.stringify({submittedAt:version}),version,id,version),
  ]);if(!result[0].meta.changes)throw new ApiError(409,"已有新版本，請重新載入。");
 }else throw new ApiError(400,"不支援的操作。");return response({saved:true});
}catch(e){return handleError(e);}}
