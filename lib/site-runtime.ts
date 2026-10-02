export const MAIN_SITE = "https://syp-local-knowledge.changehakka.chatgpt.site/";
function setting(name: string, fallback: string) {
  return typeof document === "undefined" ? fallback : document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? fallback;
}
export function isPublicPages() { return setting("syp-mode", "server") === "public-pages"; }
export function homePath() { return setting("syp-home", "/"); }
export function assetPath(filename: string) { return `${setting("syp-assets", "/")}${filename}`; }
