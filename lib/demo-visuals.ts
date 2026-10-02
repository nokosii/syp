export interface DemoVisual { file: string; alt: string; caption: string; prompts: string[] }
const visuals: Record<string, DemoVisual> = {
  "demo-coast": { file: "coast", alt: "海岸潮池、石滬與觀察筆記的 AI 示意插畫", caption: "從潮汐、石材與生態，閱讀海岸的生活知識。", prompts: ["觀察日期、潮位與天氣是否一併留下？", "訪談內容能否回到逐字稿或錄音時間碼？", "哪些物種或歷史說法仍待確認？"] },
  "demo-town": { file: "town", alt: "街區店面、騎樓與學員走讀的 AI 示意插畫", caption: "沿著一條街，連結空間觀察與居民記憶。", prompts: ["步行路線、位置與照片編號是否對得起來？", "不同居民的生活記憶有哪些差異？", "建築年代是否有文獻支持？"] },
  "demo-river": { file: "river", alt: "學員在河岸觀察並記錄水環境的 AI 示意插畫", caption: "把河岸觀察帶進課堂，讓紀錄可以重複比較。", prompts: ["測點、時間、天氣與觀察方法是否清楚？", "量測單位、儀器與校正情形是否保留？", "結論是否超出單次觀察能支持的範圍？"] },
  "demo-language": { file: "language", alt: "長輩與青年在茶桌旁進行口述訪談的 AI 示意插畫", caption: "保留原來的語言，也保留說話者的語境與同意。", prompts: ["受訪者是否理解公開範圍與撤回方式？", "腔調、用字與華語對照是否經過核對？", "逐字稿是否保留錄音時間碼？"] },
  "demo-farm": { file: "farm", alt: "農田、蔬菜與食農學習的 AI 示意插畫", caption: "從田間到餐桌，保存作物與飲食的學習過程。", prompts: ["現場觀察、農友經驗與查到的資料是否區分？", "季節、作物階段與田間管理是否記錄？", "料理步驟、份量與來源是否交代清楚？"] },
  "demo-source": { file: "source", alt: "書籍、地圖與文獻整理桌面的 AI 示意插畫", caption: "讓每一段引用，都能回到原始資料。", prompts: ["作者、出版日期、頁碼或網址是否齊全？", "地圖的年代、比例尺與製圖目的是否核對？", "授權是否允許公開引用或轉載？"] },
};
export function demoVisual(id: string, isDemo: boolean) { return isDemo ? visuals[id] : undefined; }
