export async function importText(file: File): Promise<string> {
  if (file.size > 10_485_760) throw new Error("匯入檔案上限為 10 MB。");
  if (/\.(txt|md)$/i.test(file.name)) return (await file.text()).trim();
  if (/\.pdf$/i.test(file.name)) {
    const url = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
    const pdfjs = await import(/* @vite-ignore */ url);
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/", cMapPacked: true }).promise;
    try {
      if (pdf.numPages > 100) throw new Error("請先拆分超過 100 頁的 PDF。");
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        pages.push(text.items.map((item: {str?: string; hasEOL?: boolean}) => (item.str ?? "") + (item.hasEOL ? "\n" : " ")).join(""));
      }
      const result = pages.join("\n\n").trim();
      if (result.length < 30) throw new Error("這份 PDF 可能是掃描影像。請先完成 OCR，再匯入文字。");
      return result;
    } finally { await pdf.destroy(); }
  }
  throw new Error("文字匯入支援 TXT、Markdown 與含文字的 PDF；影音和照片可作為附件保存。");
}
