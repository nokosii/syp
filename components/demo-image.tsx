import { demoVisual } from "@/lib/demo-visuals";
import { assetPath } from "@/lib/site-runtime";

export function DemoImage({ id, isDemo, detail = false }: { id: string; isDemo: boolean; detail?: boolean }) {
  const visual = demoVisual(id, isDemo);
  if (!visual) return null;
  return <figure className={detail ? "demo-visual detail-visual" : "demo-visual card-visual"}>
    <picture>
      <source srcSet={`${assetPath(`illustrations/${visual.file}-640.webp`)} 640w, ${assetPath(`illustrations/${visual.file}-1280.webp`)} 1280w`} sizes={detail ? "(max-width: 850px) 90vw, 750px" : "(max-width: 560px) 90vw, (max-width: 1200px) 45vw, 30vw"} type="image/webp" />
      <img src={assetPath(`illustrations/${visual.file}-1280.webp`)} alt={visual.alt} width={1280} height={853} loading={detail ? "eager" : "lazy"} decoding="async" />
    </picture>
    <span className="visual-label">AI 示意插畫</span>
    <figcaption>{visual.caption}{detail && <small>圖像為教學示意，未描繪經核實的現場、人物或田野成果。</small>}</figcaption>
  </figure>;
}

export function DemoReadingGuide({ id, isDemo }: { id: string; isDemo: boolean }) {
  const visual = demoVisual(id, isDemo);
  if (!visual) return null;
  return <aside className="reading-guide" aria-label="閱讀與觀察提問"><div className="eyebrow">從紀錄開始練習</div><h3>帶著這些問題閱讀</h3><ul>{visual.prompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul></aside>;
}
