import index from "@/lib/demo-index.json";
import { database, handleError, requireReviewer, response } from "@/lib/server";
export async function POST(request: Request) {
  try {
    await requireReviewer(request); const db = database();
    let inserted = 0;
    for (const d of index.documents) {
      if (await db.prepare("SELECT id FROM documents WHERE id=?").bind(d.id).first()) continue;
      const now = new Date().toISOString();
      await db.batch([
        db.prepare("INSERT INTO documents (id,title,summary,content,region,category,author,course,recorded_at,tags,source_url,license,consent,status,is_demo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(d.id,d.title,d.summary,d.content,d.region,d.category,d.author,d.course,d.recordedAt,JSON.stringify(d.tags),d.sourceUrl,d.license,1,"published",1,now,now),
        ...d.chunks.map((c, i) => db.prepare("INSERT INTO chunks (id,document_id,position,content,embedding,model) VALUES (?,?,?,?,?,?)").bind(`${d.id}-${i}`,d.id,i,c.content,JSON.stringify(c.embedding),index.model)),
      ]); inserted++;
    }
    return response({ inserted });
  } catch (error) { return handleError(error); }
}
