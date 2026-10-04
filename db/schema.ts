import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  library: text("library").notNull().default(""),
  libraryFields: text("library_fields").notNull().default("{}"),
  ownerId: text("owner_id"),
  submittedAt: text("submitted_at").notNull().default(""),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  region: text("region").notNull(),
  category: text("category").notNull(),
  author: text("author").notNull(),
  course: text("course").notNull(),
  recordedAt: text("recorded_at").notNull(),
  tags: text("tags").notNull(),
  sourceUrl: text("source_url").notNull(),
  license: text("license").notNull(),
  consent: integer("consent").notNull().default(0),
  status: text("status").notNull().default("draft"),
  isDemo: integer("is_demo").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  accessLevel: text("access_level").notNull().default("editor"),
  aiAllowed: integer("ai_allowed").notNull().default(0),
  reviewState: text("review_state").notNull().default("pending"),
  community: text("community").notNull().default(""),
  culturalContext: text("cultural_context").notNull().default(""),
  reviewNote: text("review_note").notNull().default(""),
}, table => [index("idx_documents_status_region").on(table.status, table.region)]);

export const chunks = sqliteTable("chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(),
  model: text("model").notNull(),
}, table => [index("idx_chunks_document").on(table.documentId)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  objectKey: text("object_key").notNull(),
}, table => [index("idx_attachments_document").on(table.documentId)]);

export const governanceEvents = sqliteTable("governance_events", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  reason: text("reason").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_governance_document").on(table.documentId)]);

export const members = sqliteTable("members", {
 id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(),
 role: text("role").notNull().default("teacher"), state: text("state").notNull().default("pending"),
 createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const collaborators = sqliteTable("collaborators", {
 id: text("id").primaryKey(), documentId: text("document_id").notNull().references(()=>documents.id,{onDelete:"cascade"}),
 memberId: text("member_id").notNull().references(()=>members.id,{onDelete:"cascade"}),
},t=>[index("idx_collaborators_document").on(t.documentId,t.memberId)]);
export const comments = sqliteTable("comments", {
 id:text("id").primaryKey(),documentId:text("document_id").notNull().references(()=>documents.id,{onDelete:"cascade"}),
 actor:text("actor").notNull(),content:text("content").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("idx_comments_document").on(t.documentId)]);

export const imports = sqliteTable("imports", {id:text("id").primaryKey(),fingerprint:text("fingerprint").notNull(),result:text("result").notNull(),createdAt:text("created_at").notNull()});
