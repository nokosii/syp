import { currentMember, reviewer, createSession, editor, handleError, jsonBody, response, sameOrigin } from "@/lib/server";
export async function GET(request: Request) { return response({ editor: await editor(request),reviewer:await reviewer(request),member:await currentMember(request) }); }
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await jsonBody(request, 1000);
    const value = await createSession(typeof body.key === "string" ? body.key : "");
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return Response.json({ editor: true }, { headers: { "Set-Cookie": `syp_editor=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`, "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request) {
  try { sameOrigin(request); return Response.json({ editor: false }, { headers: { "Set-Cookie": "syp_editor=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0", "Cache-Control": "no-store" } }); }
  catch (error) { return handleError(error); }
}
