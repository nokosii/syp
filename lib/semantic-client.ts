import { type SearchResult } from "./knowledge";
interface WorkerReply { id: number; status?: string; result?: number[][] | string; error?: string }
let worker: Worker | undefined;
let serial = 0;
const pending = new Map<number, { resolve: (value: number[][] | string) => void; reject: (error: Error) => void; progress: (message: string) => void }>();
function run(action: string, payload: unknown, progress: (message: string) => void): Promise<number[][] | string> {
  if (!worker) {
    worker = new Worker("/semantic-worker.js", { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      const item = pending.get(data.id); if (!item) return;
      if (data.status) item.progress(data.status);
      if (data.error) { item.reject(new Error(data.error)); pending.delete(data.id); }
      if (data.result !== undefined) { item.resolve(data.result); pending.delete(data.id); }
    };
    worker.onerror = () => {
      for (const item of pending.values()) item.reject(new Error("語意模型未能載入。請確認網路，或先使用關鍵字查找。"));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  return new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject, progress }); worker!.postMessage({ id, action, payload }); });
}
export async function embed(texts: string[], type: "query" | "passage", progress: (message: string) => void) {
  return await run("embed", { texts, type }, progress) as number[][];
}
export async function generate(question: string, sources: SearchResult[], progress: (message: string) => void) {
  const { ragMessages } = await import("./knowledge");
  return await run("generate", { messages: ragMessages(question, sources) }, progress) as string;
}
