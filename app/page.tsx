"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Archive, BookOpen, Check, ChevronDown, Download, FileText, FolderOpen, Leaf, LoaderCircle, LockKeyhole, MapPin, Menu, MessageSquareText, Plus, Search, Sparkles, Upload, Waves, X } from "lucide-react";
import { CATEGORIES, REGIONS, type KnowledgeDocument, type SearchResult } from "@/lib/knowledge";
import { api } from "@/lib/api-client";
import { homePath, isPublicPages, MAIN_SITE } from "@/lib/site-runtime";
import { DemoImage, DemoReadingGuide } from "@/components/demo-image";
import { CommunityHub, Portal, hubTitles, type HubView } from "@/components/community-hub";
import { GovernancePanel } from "@/components/governance-panel";
import { KnowledgeWorkbench } from "@/components/knowledge-workbench";
import { MemberCenter } from "@/components/member-center";
import { CollaborationPanel } from "@/components/collaboration-panel";
import { LIBRARIES,libraryById,libraryContent } from "@/lib/libraries";
import { canRead, canUseAI } from "@/lib/governance";

type View = "explore" | "ask" | "contribute" | "members" | HubView;
function RegionIcon({ region }: {region: string}) {
  return region === "新屋" ? <Waves /> : region === "楊梅" ? <Archive /> : region === "平鎮" ? <Leaf /> : <BookOpen />;
}
export default function Home() {
  const publicPages = isPublicPages();
  const [view, setView] = useState<View>("explore");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [region, setRegion] = useState("");
  const [libraryFilter,setLibraryFilter]=useState("");
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [semantic, setSemantic] = useState(true);
  const [includeDemo, setIncludeDemo] = useState(true);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [answer, setAnswer] = useState("");
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<KnowledgeDocument | null>(null);
  const [isReviewer,setReviewer]=useState(false);
  const [editor, setEditor] = useState(false);
  const [login, setLogin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [key, setKey] = useState("");
  const [toast, setToast] = useState("");
  const [manage, setManage] = useState(false);
  const [editing, setEditing] = useState<KnowledgeDocument | null>(null);
  const detailClose = useRef<HTMLButtonElement>(null);

  async function load(management = manage) {
    setLoading(true);
    try { const data = await api<{documents: KnowledgeDocument[]}>(`/api/documents${management ? "?manage=1" : ""}`); setDocuments(data.documents); setError(""); }
    catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  }
  async function refreshSession(){const data=await api<{editor:boolean;reviewer?:boolean}>("/api/session");setEditor(data.editor);setReviewer(!!data.reviewer);}
  useEffect(() => { const v=new URLSearchParams(location.search).get("view");if(v==="members"||v==="contribute")setView(v);void load(false); void refreshSession().catch(() => {}); }, []); // initial durable data load
  useEffect(() => { const id = new URLSearchParams(location.search).get("document"); if (id) void openDocument(id); }, []);
  useEffect(() => { if (detail) detailClose.current?.focus(); }, [detail]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 7000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === "Escape") { setDetail(null); setLogin(false); setMenu(false); } }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  useEffect(() => {
    if (!detail && !login) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = document.querySelector('[role="dialog"]');
      const items = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select,textarea');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", trap); };
  }, [detail, login]);

  async function search(value = text) {
    if (value.trim().length < 2) { setError("請輸入至少兩個字的問題或關鍵字。"); return; }
    setBusy(true); setError(""); setAnswer(""); setResults(null); setQuery(value.trim());
    try {
      let vector: number[] | undefined;
      if (semantic) { const { embed } = await import("@/lib/semantic-client"); [vector] = await embed([value.trim()], "query", setProgress); }
      setProgress("查找相關來源…");
      const { EMBEDDING_MODEL } = await import("@/lib/knowledge");
      const data = await api<{results: SearchResult[]}>("/api/search", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ query: value.trim(), vector, model: vector ? EMBEDDING_MODEL : undefined, region: region || undefined, category: category || undefined, includeDemo }) });
      setResults(data.results);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); setProgress(""); }
  }
  async function openDocument(id: string) {
    try { setDetail(await api<KnowledgeDocument>(`/api/documents/${id}`)); }
    catch (err) { setError((err as Error).message); }
  }
  async function generateAnswer() {
    if (!results?.length) return;
    setGenerating(true); setError("");
    try {
      const current = await Promise.all([...new Set(results.map(r => r.documentId))].map(id => api<KnowledgeDocument>(`/api/documents/${id}`)));
      if (current.some(d => !canUseAI(d))) { setResults(null); throw new Error("來源權限已變更，請重新查找資料。"); }
      if (results.some(r => !current.find(d => d.id === r.documentId)?.content?.includes(r.content))) { setResults(null); throw new Error("來源原文已修訂，請重新查找資料。"); }
      const { generate } = await import("@/lib/semantic-client"); setAnswer(await generate(query, results, setProgress)); }
    catch (err) { setError((err as Error).message); } finally { setGenerating(false); setProgress(""); }
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try { await api("/api/session", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({key}) }); setEditor(true); void refreshSession(); setKey(""); setLogin(false); setToast("已登入，可收錄與編輯成果。"); }
    catch (err) { setError((err as Error).message); }
  }
  function changeView(value: View) { setView(value); setMenu(false); setError(""); }
  const filtered = documents.filter(d => (!libraryFilter||d.library===libraryFilter) && (!region || d.region === region) && (!category || d.category === category) && (includeDemo || !d.isDemo));
  const published = documents.filter(canRead);

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <a className="brand" href={homePath()} aria-label="新楊平在地知識庫首頁"><span className="brand-mark"><BookOpen size={27}/></span><span><strong>新楊平</strong><small>社區大學 · 在地知識庫</small></span></a>
      <div className="sidebar-caption">地方，從理解開始</div>
      <nav aria-label="主要導覽">
        <button className={view === "explore" ? "nav-link active" : "nav-link"} onClick={() => changeView("explore")}><FolderOpen/>探索知識</button>
        <button className={view === "ask" ? "nav-link active" : "nav-link"} onClick={() => changeView("ask")}><MessageSquareText/>語意問答</button>
        {(Object.keys(hubTitles) as HubView[]).map(v => <button key={v} className={view === v ? "nav-link active" : "nav-link"} onClick={() => changeView(v)}><BookOpen/>{hubTitles[v]}</button>)}
        <button className={view === "members" ? "nav-link active" : "nav-link"} onClick={() => changeView("members")}><FolderOpen/>會員與共筆</button>
        <button className={view === "contribute" ? "nav-link active" : "nav-link"} onClick={() => changeView("contribute")}><Plus/>成果收錄</button>
      </nav>
      <div className="sidebar-divider"/>
      <div className="sidebar-label">我們的地方</div>
      {REGIONS.slice(0, 3).map(r => <button key={r} className={`region-link ${region === r ? "selected" : ""}`} onClick={() => {setRegion(region === r ? "" : r); setResults(null); changeView("explore");}}><MapPin size={17}/>{r}<span>{published.filter(d => d.region === r).length}</span></button>)}
      <div className="sidebar-bottom"><p>教學的累積<br/>田野的發現<br/><strong>成為地方共同的知識。</strong></p><a href="https://syp.org.tw/" target="_blank" rel="noopener noreferrer">新楊平社區大學官網</a><small>新屋 · 楊梅 · 平鎮</small></div>
    </aside>
    {menu && <button className="sidebar-backdrop" aria-label="關閉導覽" onClick={() => setMenu(false)}/>}
    <main className="main">
      <header className="topbar"><div className="breadcrumb"><button className="menu-button icon-button" aria-label="開啟導覽" onClick={() => setMenu(true)}><Menu/></button><span>在地知識庫</span><span className="crumb-slash">/</span><strong>{view === "explore" ? "探索知識" : view === "ask" ? "語意問答" : view === "contribute" ? "成果收錄" : view === "members" ? "會員與共筆" : hubTitles[view as HubView]}</strong></div>{publicPages ? <a className="login-button" href={MAIN_SITE} target="_blank" rel="noopener noreferrer"><LockKeyhole size={16}/>主系統登入</a> : <button className="login-button" onClick={()=>changeView("members")}><LockKeyhole size={16}/>{editor?"會員工作區":"會員登入／申請"}</button>}</header>
      <div className="workspace">
        {publicPages && <div className="collection-note"><BookOpen size={20}/><p><strong>公開展示版。</strong>可瀏覽六份示範紀錄、語意檢索及整理回答。正式成果與附件請至 <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer">主系統</a> 收錄；本頁不會自動同步主系統的新資料。</p></div>}
        {view === "explore" && <Portal go={changeView}/>}
        {view in hubTitles && <CommunityHub view={view as HubView} documents={documents} open={id=>void openDocument(id)} ask={value=>{changeView("ask");setText(value);setResults(null);}} go={changeView} editor={editor} publicPages={publicPages}/>}
        {(view === "explore" || view === "ask") && <>
          <div className="page-heading"><div><div className="eyebrow">SYP COMMUNITY KNOWLEDGE</div><h1>{view === "ask" ? "向地方知識提問" : "探索我們生活的地方"}</h1><p>{view === "ask" ? "用自己的話提問，從教學與田野的紀錄中尋找答案。" : "讓教學的成果與田野的發現，在這裡持續累積。"}</p></div><button className="outline-button heading-action" onClick={() => changeView("contribute")}><Plus size={18}/>收錄成果</button></div>
          <section className="search-panel" aria-label="知識檢索">
            <form onSubmit={e => {e.preventDefault(); void search();}}><div className="search-field"><Search size={24}/><input aria-label="問題或關鍵字" placeholder="例如：傳統捕魚的知識如何傳承？" value={text} maxLength={500} onChange={e => setText(e.target.value)}/><button className="primary-button" disabled={busy || generating} type="submit">{busy ? <LoaderCircle className="spin" size={18}/> : <Search size={18}/>}查找知識</button></div></form>
            <div className="search-options"><label className="toggle-label"><input type="checkbox" checked={semantic} onChange={e => {setSemantic(e.target.checked); setResults(null);}}/><Sparkles size={16}/>{semantic ? "語意檢索" : "關鍵字檢索"}</label><span className="search-hint">{semantic ? "不用精準關鍵字，也能找到相關的內容" : "依文字比對查找，不載入語意模型"}</span></div>
            <div className="suggestions"><span>試著問</span>{["傳統捕魚的知識如何傳承", "學生如何記錄溪流污染", "如何保存長輩的故事"].map(value => <button key={value} disabled={busy || generating} onClick={() => {setText(value); void search(value);}}>{value}</button>)}</div>
          </section>
          <div className="stats-line"><span><strong>{published.length}</strong>份已發布成果</span><span><strong>{published.reduce((n, d) => n + (d.chunkCount ?? 0), 0)}</strong>個可查找段落</span><span><strong>3</strong>個在地區域</span><span className="stats-note">以來源為本，讓知識可以回查</span></div>
          <div className="filters"><div className="region-tabs" role="group" aria-label="區域篩選">{["", ...REGIONS].map(r => <button key={r} className={region === r ? "selected" : ""} onClick={() => {setRegion(r); setResults(null); setAnswer("");}}>{r || "全部地方"}</button>)}</div><div className="filter-right"><label className="select-wrap"><span className="sr-only">成果類型</span><select value={category} onChange={e => {setCategory(e.target.value); setResults(null);}}><option value="">所有類型</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={16}/></label><label className="demo-toggle"><input type="checkbox" checked={includeDemo} onChange={e => {setIncludeDemo(e.target.checked); setResults(null);}}/>包含示範</label></div></div>
          {(busy || generating) && <div className="progress-message" role="status"><LoaderCircle size={20} className="spin"/>{progress || "處理中…"}</div>}
          {error && <div className="error-message" role="alert">{error}</div>}
          {results !== null && <section className="results-section"><div className="section-heading"><h2>「{query}」的相關來源</h2><button className="text-button" onClick={() => {setResults(null); setAnswer("");}}>返回成果瀏覽</button></div>
            {results.length > 0 ? <><div className="answer-panel"><div className="answer-title"><Sparkles size={21}/><h3>{answer ? "依最相關紀錄整理的回答" : "找到相關紀錄，先從來源開始"}</h3></div>{answer ? <><p className="generated-answer">{answer}</p><small>模型整理可能有誤，請對照下方原文。引用編號對應來源列表。</small></> : <><p>下方段落是直接取自成果原文的摘錄。您也可以讓模型整理最相關紀錄的原文。</p><button className="outline-button" disabled={generating || busy} onClick={() => void generateAnswer()}><Sparkles size={17}/>根據來源整理回答</button><small>首次下載回答模型約 750 MB，需支援 WebGPU 的瀏覽器；內容在您的裝置處理。</small></>}{results.some(r => r.isDemo) && <div className="demo-warning">本次來源包含示範資料，不能作為已發生的田野或教學事實。</div>}</div><div className="source-list">{results.map((r, i) => <article key={r.id} className="source-card"><div className="source-number">{i + 1}</div><div><div className="card-meta"><span>{r.region}</span><span>{r.category}</span>{r.isDemo && <span className="demo-badge">示範</span>}<span>段落 {r.position + 1}</span></div><button className="source-title" onClick={() => void openDocument(r.documentId)}>{r.title}</button><p>{r.content}</p><button className="text-button" onClick={() => void openDocument(r.documentId)}>閱讀完整原文</button></div></article>)}</div></> : <div className="empty-state"><Search size={34}/><h3>目前沒有足夠相關的來源</h3><p>試著換個問法、放寬篩選，或收錄更多成果。資料不足時，系統不會補寫答案。</p></div>}
          </section>}
          {results === null && !busy && <><div className="section-heading"><h2>{region ? `${region}的知識紀錄` : "知識紀錄"}<span className="count-label">{filtered.length}</span></h2>{editor && <button className="text-button" onClick={() => {const next = !manage; setManage(next); void load(next);}}>{manage ? "僅顯示發布成果" : "管理成果與草稿"}</button>}</div>
            <label className="library-filter">六大庫<select value={libraryFilter} onChange={e=>setLibraryFilter(e.target.value)}><option value="">所有知識庫</option>{LIBRARIES.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            {loading ? <div className="empty-state" role="status"><LoaderCircle className="spin"/>讀取成果中…</div> : filtered.length ? <div className="document-grid">{filtered.map(d => <article className={`document-card region-${d.region}`} key={d.id}><DemoImage id={d.id} isDemo={d.isDemo}/><div className="card-top"><div className="region-emblem"><RegionIcon region={d.region}/></div><span className="category-badge">{d.category}</span></div><div className="card-meta"><span><MapPin size={14}/>{d.region}</span>{d.isDemo && <span className="demo-badge">示範資料</span>}{d.status === "draft" && <span className="draft-badge">草稿</span>}</div><button className="card-title" onClick={() => void openDocument(d.id)}>{d.title}</button><span className="category-badge">{d.library?libraryById(d.library).name:"待分類"}</span>{d.submittedAt&&d.governance?.reviewState==="pending"&&<span className="draft-badge">已送審</span>}<p>{d.summary}</p><div className="tags">{d.tags.slice(0, 3).map(tag => <span key={tag}>#{tag}</span>)}</div><div className="card-footer"><span>{d.author}</span><button className="text-button" onClick={() => void openDocument(d.id)}>閱讀紀錄</button></div></article>)}</div> : <div className="empty-state"><BookOpen size={36}/><h3>地方知識，從第一份紀錄開始</h3><p>{!includeDemo ? "尚無符合篩選的正式成果。您可以收錄教學或田野紀錄。" : "尚無符合篩選的成果。試著選擇其他地方或類型。"}</p><button className="outline-button" onClick={() => changeView("contribute")}><Plus size={18}/>收錄成果</button></div>}
            {documents.some(d => d.isDemo) && includeDemo && <div className="collection-note"><BookOpen size={20}/><p><strong>目前包含操作示範。</strong>示範內容用於體驗收錄與檢索，不代表社大已完成的調查或課程成果。正式資料可由教師與田野團隊逐步加入。</p></div>}
          </>}
        </>}
        {view === "members" && <><MemberCenter onChanged={()=>void refreshSession()}/>{!publicPages&&<button className="text-button" onClick={()=>setLogin(true)}>管理員維護登入</button>}</>}
        {view === "contribute" && <KnowledgeWorkbench key={editing?.id??"new"} editingLibrary={editing?.library} allowed={editor} onSaved={()=>void load(manage)}>{library=><Contribution key={(editing?.id??"new")+library} library={library} allowed={editor} editing={editing} onSaved={()=>{setEditing(null);setToast("草稿已保存，可邀請共同編輯者、留言及送審。");changeView("explore");setManage(true);void load(true);}} onCancel={()=>{setEditing(null);changeView("explore");}}/>}</KnowledgeWorkbench>}
        <footer className="footer"><span>新楊平社區大學 · 在地知識庫</span><span>記錄地方 · 連結學習</span></footer>
      </div>
    </main>
    {toast && <div className="toast" role="status"><Check size={19}/>{toast}<button aria-label="關閉通知" className="icon-button" onClick={() => setToast("")}><X size={16}/></button></div>}
    {login && <div className="modal-backdrop"><section className="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="modal-close icon-button" aria-label="關閉登入" onClick={() => setLogin(false)}><X/></button><LockKeyhole size={32}/><h2 id="login-title">編輯登入</h2><p>輸入管理員提供的編輯金鑰，即可收錄及管理成果。</p><form onSubmit={signIn}><label htmlFor="editor-key">編輯金鑰</label><input id="editor-key" autoFocus type="password" autoComplete="current-password" required value={key} onChange={e => setKey(e.target.value)} maxLength={200}/>{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button" type="submit">登入</button></form></section></div>}
    {detail && <div className="modal-backdrop"><article className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button ref={detailClose} className="modal-close icon-button" aria-label="關閉原文" onClick={() => setDetail(null)}><X/></button><div className="card-meta"><span>{detail.region}</span><span>{detail.category}</span>{detail.isDemo && <span className="demo-badge">示範資料</span>}{detail.status === "draft" && <span className="draft-badge">草稿</span>}</div><h2 id="detail-title">{detail.title}</h2><p className="detail-summary">{detail.summary}</p><DemoImage id={detail.id} isDemo={detail.isDemo} detail/><dl className="metadata-grid"><div><dt>記錄者</dt><dd>{detail.author}</dd></div><div><dt>課程／計畫</dt><dd>{detail.course || "未填寫"}</dd></div><div><dt>記錄日期</dt><dd>{detail.recordedAt || "未填寫"}</dd></div><div><dt>使用授權</dt><dd>{detail.license}</dd></div></dl><div className="detail-content">{detail.content}</div><DemoReadingGuide id={detail.id} isDemo={detail.isDemo}/>{detail.sourceUrl && <a className="outline-button" href={detail.sourceUrl} target="_blank" rel="noopener noreferrer">查看原始來源</a>}{!!detail.attachments?.length && <div className="attachments"><h3>原始附件</h3>{detail.attachments.map(file => <a key={file.id} href={`/api/attachments/${file.id}`} className="attachment"><FileText size={18}/>{file.filename}<span>{(file.size / 1024).toFixed(0)} KB</span><Download size={17}/></a>)}</div>}{editor&&detail.permissions?.edit&&!detail.isDemo&&<CollaborationPanel id={detail.id} version={detail.updatedAt} onChanged={()=>{void openDocument(detail.id);void load(manage);}}/>}<GovernancePanel key={detail.id+detail.updatedAt} document={detail} editor={editor&&!!detail.permissions?.edit} reviewer={isReviewer} onChanged={()=>{void openDocument(detail.id);void load(manage);setResults(null);setAnswer("");setToast("治理決定已儲存。");}}/><div className="detail-actions"><button className="outline-button" onClick={async () => {await navigator.clipboard.writeText(`${detail.title}｜${detail.author}｜${detail.recordedAt || "未註記日期"}｜新楊平在地知識庫\n${detail.sourceUrl || `${location.origin}${homePath()}?document=${encodeURIComponent(detail.id)}`}\n授權：${detail.license}${detail.isDemo ? "\n【示範資料，非正式成果】" : ""}`); setToast("引用資訊已複製。");}}>複製引用資訊</button>{editor && detail.permissions?.edit && !detail.isDemo && <button className="outline-button" onClick={() => {setEditing(detail); setDetail(null); changeView("contribute");}}>編輯成果</button>}{isReviewer && <button className="danger-button" onClick={async () => {if (!window.confirm(`確定刪除「${detail.title}」及附件？此操作無法復原。`)) return; try {await api(`/api/documents/${detail.id}`, {method:"DELETE"}); setDetail(null); setToast("成果已刪除。"); void load(manage);} catch (err) {setError((err as Error).message);}}}>刪除成果</button>}</div></article></div>}
  </div>;
}

export function Contribution({editing,library,allowed,onSaved,onCancel}:{editing:KnowledgeDocument|null;library:string;allowed:boolean;onSaved:()=>void;onCancel:()=>void}) {
  const spec=libraryById(library);
  const [fields,setFields]=useState<Record<string,string>>(editing?.libraryFields??{});
  const suffix=libraryContent(library,editing?.libraryFields??{},"");
  const original=editing?.content??"";
  const originalBody=suffix&&original.endsWith(suffix)?original.slice(0,-suffix.length).trimEnd():original;
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [progress, setProgress] = useState("");
  const [content, setContent] = useState(originalBody), [summary, setSummary] = useState(editing?.summary ?? "");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if(!allowed)throw new Error("請先登入並取得會員核准。");
      const form = new FormData(event.currentTarget);
      const complete=libraryContent(library,fields,content);
      if (complete.trim().length < 30 || complete.length > 20000) throw new Error("原文需為 30–20,000 字；較長內容請分篇收錄。");
      const { embed } = await import("@/lib/semantic-client");
      const { chunkText, EMBEDDING_MODEL } = await import("@/lib/knowledge");
      const aiPreparation = form.get("aiPreparation") === "on";
      const pieces = aiPreparation ? chunkText(complete) : [];
      const vectors = pieces.length ? await embed(pieces, "passage", setProgress) : [];
      const body = { library,libraryFields:fields,aiPreparation, expectedUpdatedAt: savedVersion ?? editing?.updatedAt, title: form.get("title"), summary, content: complete.trim(), region: form.get("region"), category: form.get("category"), author: form.get("author"), course: form.get("course"), recordedAt: form.get("recordedAt"), tags: String(form.get("tags")).split(/[,，、]/).map(s => s.trim()).filter(Boolean), sourceUrl: form.get("sourceUrl"), license: form.get("license"), consent: form.get("consent") === "on", status: form.get("status"), model: EMBEDDING_MODEL, chunks: pieces.map((piece, i) => ({content:piece, embedding:vectors[i]})) };
      setProgress("儲存原文與索引…");
      const id = editing?.id ?? savedId;
      const data = await api<{id: string; updatedAt: string}>(id ? `/api/documents/${id}` : "/api/documents", { method: id ? "PUT" : "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      setSavedId(data.id); setSavedVersion(data.updatedAt);
      if (attachment) {
        setProgress("上傳原始附件…"); const files = new FormData(); files.append("file", attachment);
        try { const uploaded=await api<{updatedAt:string}>(`/api/documents/${data.id}/attachments`, { method:"POST", body:files });setSavedVersion(uploaded.updatedAt);setAttachment(null); }
        catch (err) { throw new Error(`原文已儲存，但附件未上傳：${(err as Error).message} 可保留這份表單並重試。`); }
      }
      onSaved();
    } catch (err) {setError((err as Error).message);} finally {setBusy(false); setProgress("");}
  }
  return <form className="contribution-form" ref={formRef} onSubmit={save}>
    <div className="form-intro"><FileText size={22}/><div><h2>{spec.name} · {spec.layout}</h2><p>原文可單獨保存；取得 AI 處理同意後才建立索引。影音與照片保留為附件，尚不自動轉錄。</p></div></div>
    <div className={`library-specific library-${library}`}><h3>{spec.layout}專屬欄位</h3>{spec.fields.map((field,i)=><label key={field}><span>{String(i+1).padStart(2,"0")} · {field}</span><textarea rows={library==="craft"&&i===2?6:3} maxLength={3000} value={fields[field]??""} onChange={e=>setFields({...fields,[field]:e.target.value})} placeholder={library==="news"&&i===3?"逐項列出證據、查核方式與尚未確認的說法":"請填寫可追溯的紀錄；敏感內容請依授權處理"}/></label>)}</div>
    <div className="form-grid"><label className="full-width">成果標題<input name="title" required minLength={2} maxLength={150} defaultValue={editing?.title} placeholder="例如：海岸走讀的觀察與訪談紀錄"/></label><label>地方<select name="region" defaultValue={editing?.region ?? "新屋"}>{REGIONS.map(r => <option key={r}>{r}</option>)}</select></label><label>成果類型<select name="category" defaultValue={editing?.category ?? "田野紀錄"}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>記錄者／團隊<input name="author" required maxLength={100} defaultValue={editing?.author} placeholder="教師、學員或田野團隊"/></label><label>課程／計畫<input name="course" maxLength={150} defaultValue={editing?.course}/></label><label>實際記錄日期<input name="recordedAt" type="date" defaultValue={editing?.recordedAt}/></label><label>主題標籤<input name="tags" maxLength={380} defaultValue={editing?.tags.join("、")} placeholder="以逗號或頓號分隔，最多 12 個"/></label><label className="full-width">內容摘要<textarea value={summary} onChange={e => setSummary(e.target.value)} required minLength={10} maxLength={500} rows={3} placeholder="用幾句話說明這份成果的內容與範圍。"/></label>
    <div className="full-width import-block"><span>匯入文字</span><label className="outline-button upload-label"><Upload size={18}/>選擇 TXT、MD 或 PDF<input type="file" accept=".txt,.md,.pdf" disabled={busy} onChange={async e => {const file = e.target.files?.[0]; if (!file) return; setBusy(true); setError(""); setProgress("擷取檔案文字…"); try {const { importText } = await import("@/lib/import-file"); const value = await importText(file); if (value.length > 20000) throw new Error("檔案超過 20,000 字，請先拆分成多份成果。"); setContent(value); setAttachment(file); if (!summary) setSummary(value.slice(0, 180));} catch (err) {setError((err as Error).message);} finally {setBusy(false); setProgress(""); e.target.value="";}}}/></label><small>支援含文字的 PDF。掃描檔請先 OCR；匯入後請核對原文。</small></div>
    <label className="full-width">成果原文<textarea value={content} onChange={e => setContent(e.target.value)} maxLength={20000} rows={12} placeholder="貼上教學成果、觀察紀錄或經過核對的逐字稿。保留來源、語境與待查證標記。"/><small>{content.length.toLocaleString()} / 20,000 字</small></label><label className="full-width">原始來源網址<input name="sourceUrl" type="url" maxLength={1000} defaultValue={editing?.sourceUrl} placeholder="選填，僅接受 http / https"/></label><label>使用授權<select name="license" defaultValue={editing?.license}>{["僅供教學研究，引用請註明來源", "CC BY 4.0", "CC BY-NC 4.0", "保留所有權利"].map(l => <option key={l}>{l}</option>)}</select></label><label>發布流程<input type="hidden" name="status" value="draft"/><span className="form-policy">先儲存草稿，再由社群審閱並決定公開範圍。修訂會重設審閱與 AI 許可。</span></label><label className="full-width">原始附件（每檔上限 10 MB）<input type="file" accept=".pdf,.txt,.md,.docx,.jpg,.jpeg,.png,.webp,.wav,.mp3,.mp4,.m4a" disabled={busy} onChange={e => setAttachment(e.target.files?.[0] ?? null)}/>{attachment && <small>將上傳：{attachment.name}</small>}</label></div>
    <label className="consent-label"><input type="checkbox" name="aiPreparation" defaultChecked={!!editing?.chunkCount}/><span>已取得允許 AI 處理文字的同意，可在本裝置建立索引；未勾選仍可保存原文，公開檢索須再經審閱確認。</span></label>
    <label className="consent-label"><input type="checkbox" name="consent" defaultChecked={editing?.consent}/><span>我已確認資料使用授權與受訪者同意，並處理個人及敏感資訊。發布成果必須勾選。</span></label>
    {!allowed&&<p className="demo-warning">{isPublicPages()?<a href={MAIN_SITE+"/?view=members"}>在主系統申請會員後保存</a>:<a href="?view=members">請先申請會員並取得管理員核准</a>}。目前可先選擇版面與填寫預覽。</p>}
    {error && <div className="error-message" role="alert">{error}</div>}{busy && <div className="progress-message" role="status"><LoaderCircle className="spin" size={20}/>{progress}</div>}
    <div className="form-actions"><button className="outline-button" type="button" disabled={busy} onClick={onCancel}>取消</button><button className="primary-button" type="submit" disabled={busy||!allowed}>{busy ? <LoaderCircle size={18} className="spin"/> : <Check size={18}/>}保存共筆草稿</button></div>
  </form>;
}
