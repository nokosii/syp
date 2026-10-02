# 新楊平在地知識庫

新楊平社區大學的教學、田野及口述成果收錄系統。以新屋、楊梅、平鎮為主要區域，保存原文與附件，提供中文語意檢索，以及可回查來源的 RAG 回答。

- 線上系統：https://syp-local-knowledge.changehakka.chatgpt.site
- GitHub Pages 公開展示：https://nokosii.github.io/syp/
- 原始碼：https://github.com/nokosii/syp
- 辦學區域依據：[新楊平社區大學介紹](https://www.syp.org.tw/content.php?id=intro)

## 可以做什麼

1. 瀏覽成果，以地方、類型及示範資料篩選。
2. 用自然語言找出相關段落；不需要輸入原文中的相同句子。
3. 閱讀原文、下載附件、複製引用資訊。
4. 編輯者匯入 TXT、Markdown、含文字的 PDF，或直接貼上原文。
5. 保存作者、課程、實際日期、標籤、來源網址、授權與受訪者同意。
6. 先存草稿，確認後再發布；草稿與附件不進入讀者的檢索。
7. 選擇「根據來源整理回答」，以裝置上的語言模型生成附來源編號的回答。

系統內的六份資料都是**操作示範**，並非社大已完成的調查、訪談或課程成果。沒有虛構受訪者、歷史年代或監測數字。正式資料請由教師與田野團隊收錄。

## 開始使用線上系統

目前以私人網站上線，先由擁有者登入 ChatGPT 檢視。讀者權限由 Sites 的網站分享設定管理；系統的編輯金鑰是另一層寫入保護。

本次建立的編輯金鑰保存在作者工作站的 **.local-editor-key.txt**，未上傳 GitHub。點「編輯登入」後輸入該金鑰，即可收錄、修改、發布或刪除成果。金鑰同時以 secret 儲存在網站環境設定中。請只提供給授權編輯者。

第一次語意檢索會下載多語模型（ONNX 權重約 113 MB，另有 tokenizer），之後使用瀏覽器快取。生成回答需支援 WebGPU 的 Chrome / Edge 等瀏覽器，首次再下載語言模型（約 750 MB）。裝置、網路或模型服務不支援時，仍可使用關鍵字檢索並閱讀來源摘錄。

教學原文與查詢在瀏覽器建立向量；模型供應站只提供模型檔案，不接收成果原文。向量、收錄內容與附件會送至本系統保存。查詢向量送到本系統檢索；生成回答在讀者裝置執行，不需付費 API 金鑰。

## 技術架構

| 層次 | 實作 |
| --- | --- |
| 網站與 API | React 19、Vinext、Vite、Cloudflare Worker |
| 資料保存 | D1 / SQLite：成果、段落向量、附件中繼資料 |
| 原始附件 | R2，透過伺服器授權下載 |
| 語意向量 | Transformers.js 3.8.1，Xenova/multilingual-e5-small，q8，384 維 |
| 檢索 | 余弦相似度為主，少量文字比對；區域與類型先篩選 |
| RAG | 取回來源段落，再由 Qwen2.5-0.5B-Instruct q4 / WebGPU 整理附引用回答 |
| 編輯保護 | 隨機金鑰、HttpOnly / SameSite cookie、來源檢查、伺服器授權 |

程式碼流程及資料治理詳見 [系統設計](docs/SYSTEM_DESIGN.md)。

## 本機開發

### GitHub Pages 公開展示版

GitHub Pages 使用相同的 React 介面、語意模型、檢索排序及 RAG 回答。六份已存在於公開儲存庫的示範紀錄與十二個段落索引隨網站發布，查詢向量比對與回答生成均在瀏覽器執行，不需登入即可體驗。正式資料、私人草稿、附件與編輯金鑰不包含在展示版。

「成果收錄」及「主系統登入」連回原線上系統。展示版不會自動同步主系統後續新增的資料；若要公開正式紀錄，必須先審核授權、去識別化，另外匯出適合公開的資料集。主系統仍維持原有私人存取設定。

儲存庫目前以 `main` 分支根目錄發布 Pages。根目錄 `index.html`、`.nojekyll` 及 `github-pages/` 是可直接發布的編譯產物，原始入口在 `static-site/`。修改介面或展示索引後，執行 `npm run build:pages`，把生成檔案與原始碼一起提交；推送至 `main` 後 GitHub 會自動發布。CI 的 `npm run check:pages` 會確認產物與原始碼相符。所有資源與引用網址均支援 `/syp/` 子路徑。

```powershell
npm run build:pages
npm run check:pages
```

### 完整系統開發

需要 Node.js 24+、npm 與 Git。

```powershell
git clone git@github.com:nokosii/syp.git
cd syp
npm ci
npm run local:setup
npm run dev
```

網址為 http://127.0.0.1:5173/ 。本機 D1 與 R2 資料存於被 Git 忽略的 .wrangler/state。local:setup 只負責初次資料庫初始化；正式環境由發布工具執行 Drizzle 遷移。既有本機資料庫有新增遷移時，請依序執行尚未套用的 SQL，或先備份再重建測試資料庫。

第一次可匯入示範資料（以下範例不會顯示金鑰）：

```powershell
$sypEditorKey = (Get-Content .local-editor-key.txt -Raw).Trim()
Invoke-RestMethod http://127.0.0.1:5173/api/demo -Method Post -Headers @{ Authorization = "Bearer $sypEditorKey" }
```

Windows 若預設 Node 版本過舊，本次開發使用 Codex 內建 Node：

```powershell
$sypNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $sypNode scripts/local-setup.mjs
& $sypNode scripts/run-framework.mjs dev
```

## 驗證

```sh
npm run typecheck
npm test
npm run test:integration
npm run build
```

整合測試需要已啟動並初始化示範資料的本機伺服器，且只允許 localhost；會建立與清除自己的測試成果。涵蓋授權、跨站請求、草稿隔離、同意要求、附件保存、發布更新、向量維度、中文語意改寫與無關問題，共 28 個檢查。

GitHub Actions 執行型別檢查、六個檢索與引用測試及正式建置。此工作流程驗證程式碼，**不會自動發布網站**。

重建示範向量與測試向量：`npm run demo:index`。這會下載多語 E5 模型，資料儲存在忽略的 .model-cache。測試用向量隨原始碼提交，CI 不需重複下載模型。語言模型另有 `npm run test:generation`，在 Node CPU 上檢查同一套 RAG 提示及引用，需另下載模型。

## 發布與資料備份

本次正式發布使用 Sites：Drizzle 遷移 → 建置 Worker → 推送相同來源版本 → 上傳建置產物 → 部署。GitHub main 保存相同來源版本。修改後須重新發布 Sites；單純 git push 不會更新線上網站。

邏輯資源在 .openai/hosting.json，實際 D1、R2 與 secret 由平台注入，不寫入 GitHub。若改用自有 Cloudflare 帳號，請建立 DB / BUCKET、套用 drizzle/*.sql、配置 EDITOR_KEY，並部署 dist/server/wrangler.json 產物；不要使用開發資料庫 ID 當作正式資料庫。

GitHub 保存程式與示範向量，**不包含正式成果或附件備份**。營運者應定期匯出 D1 並備份 R2，保留受訪者同意與撤回紀錄。

## 第一版限制

- 單篇原文 20,000 字、每個附件 10 MB、每篇最多 10 個附件。
- 全庫上限 2,000 段；此版使用 D1 儲存向量並逐段計算。擴大前應改用專用向量索引，而非靜默截斷搜尋資料。
- PDF 只擷取可選取的文字；掃描 PDF 需先 OCR。影音／照片保存為附件，不自動轉錄或辨識。
- 小型生成模型可能誤解來源；回答是整理草稿，需與原文核對。引用編號由系統根據實際輸入原文附上；模型失敗時不顯示生成回答。
- 相似度門檻以目前中文測試校準，不是答案正確率；正式資料增多後需以人工標註問答評估召回率及誤檢。
- 第一版使用共用編輯金鑰，尚無逐人編輯帳號、審稿角色或修改稽核紀錄。

模型文件：[多語 E5](https://huggingface.co/Xenova/multilingual-e5-small)、[Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/en/index)、[Qwen2.5-0.5B-Instruct ONNX](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct)。使用與轉載模型應遵守各模型的授權條款。
