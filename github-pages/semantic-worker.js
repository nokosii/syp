// Pinned browser-only runtime keeps ONNX and large models outside the Worker server.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let encoder, generator;
let queue = Promise.resolve();
const progress = id => event => {
  if (event.status === "progress") self.postMessage({ id, status: `下載模型 ${Math.round(event.progress || 0)}%（${event.file}）` });
  if (event.status === "initiate") self.postMessage({ id, status: "首次使用正在下載模型；之後會使用瀏覽器快取。" });
};
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    const { id, action, payload } = data;
    try {
      if (action === "embed") {
        self.postMessage({ id, status: "準備語意模型…" });
        encoder ??= await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8", device: "wasm", progress_callback: progress(id) });
        const vectors = [];
        for (let i = 0; i < payload.texts.length; i++) {
          self.postMessage({ id, status: `分析語意 ${i + 1}/${payload.texts.length}` });
          const output = await encoder(`${payload.type}: ${payload.texts[i]}`, { pooling: "mean", normalize: true });
          vectors.push(Array.from(output.data));
        }
        self.postMessage({ id, result: vectors });
      } else if (action === "generate") {
        if (!navigator.gpu || !await navigator.gpu.requestAdapter()) throw new Error("這個瀏覽器未提供 WebGPU。可改用支援的 Chrome／Edge，來源摘錄仍可閱讀。");
        self.postMessage({ id, status: "準備回答模型，首次下載約 750 MB，可能需要數分鐘。" });
        generator ??= await pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct", { dtype: "q4", device: "webgpu", progress_callback: progress(id) });
        self.postMessage({ id, status: "根據來源整理回答…" });
        const output = await generator(payload.messages, { max_new_tokens: 180, do_sample: false, repetition_penalty: 1.1 });
        const answer = output[0]?.generated_text?.at(-1)?.content;
        if (typeof answer !== "string" || !answer.trim()) throw new Error("模型未能整理回答，請閱讀下方來源摘錄。");
        if (!/[。！？]/.test(answer) && !answer.includes("目前資料不足")) throw new Error("模型未能把來源整理成完整回答，請以原文摘錄為準。");
        self.postMessage({ id, result: answer.trim() });
      } else throw new Error("不支援的操作。");
    } catch (error) {
      self.postMessage({ id, error: error.message || "模型載入失敗，請確認網路後重試。" });
    }
  });
};
