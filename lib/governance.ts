import type { KnowledgeDocument } from "./knowledge.ts";

export interface Governance {
  accessLevel: "public" | "editor";
  aiAllowed: boolean;
  reviewState: "pending" | "approved" | "withdrawn";
  community: string;
  culturalContext: string;
  reviewNote: string;
}
export const demoGovernance: Governance = { accessLevel: "public", aiAllowed: true, reviewState: "approved", community: "操作示範，無真實受訪社群", culturalContext: "原創示範文字與 AI 插畫；不得解讀為真實田野成果。", reviewNote: "示範素材，非社群正式審閱紀錄。" };
// Public visibility and AI use are separate permissions. Demos have their own
// explicit policy; old formal records default to restricted pending review.
export const PUBLIC_SQL = "d.status='published' AND d.consent=1 AND (d.is_demo=1 OR (d.access_level='public' AND d.review_state='approved'))";
export const AI_SQL = `(${PUBLIC_SQL}) AND (d.is_demo=1 OR d.ai_allowed=1)`;
export function canRead(d: KnowledgeDocument) {
  return d.status === "published" && d.consent && (d.isDemo || d.governance?.accessLevel === "public" && d.governance?.reviewState === "approved");
}
export function canUseAI(d: KnowledgeDocument) { return canRead(d) && (d.isDemo || d.governance?.aiAllowed === true); }
