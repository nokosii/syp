import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
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
