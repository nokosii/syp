import { ApiError, administrator, currentMember, database, handleError, jsonBody, response, sameOrigin } from "@/lib/server";
export async function GET(request:Request){try{
 const member=await currentMember(request);const identity=!!request.headers.get("oai-authenticated-user-id")&&!!request.headers.get("oai-authenticated-user-email");
 const admin=await administrator(request);
 const rows=admin?await database().prepare("SELECT id,email,name,role,state,created_at AS createdAt FROM members ORDER BY created_at DESC LIMIT 500").all():null;
 return response({member,identity,admin,members:rows?.results??[]});
}catch(e){return handleError(e);}}
export async function POST(request:Request){try{
 sameOrigin(request);const id=request.headers.get("oai-authenticated-user-id"),email=request.headers.get("oai-authenticated-user-email");
 if(!id||!email)throw new ApiError(401,"請先使用 ChatGPT 帳號登入。");
 const d=await jsonBody(request,2000);if(typeof d.name!=="string"||!d.name.trim()||d.name.length>100)throw new ApiError(400,"請填寫 1–100 字的姓名。");
 const now=new Date().toISOString();await database().prepare("INSERT INTO members(id,email,name,role,state,created_at,updated_at) VALUES (?,?,?,'teacher','pending',?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at").bind(id,email,d.name.trim(),now,now).run();
 return response({member:await currentMember(request)});
}catch(e){return handleError(e);}}
export async function PATCH(request:Request){try{
 sameOrigin(request);if(!await administrator(request))throw new ApiError(403,"需要管理員權限。");
 const d=await jsonBody(request,3000);if(!["teacher","reviewer"].includes(d.role)||!["active","suspended"].includes(d.state)||typeof d.id!=="string")throw new ApiError(400,"會員設定不正確。");
 const r=await database().prepare("UPDATE members SET role=?,state=?,updated_at=? WHERE id=? AND role<>'admin'").bind(d.role,d.state,new Date().toISOString(),d.id).run();
 if(!r.meta.changes)throw new ApiError(404,"找不到可調整的會員。");return response({saved:true});
}catch(e){return handleError(e);}}
