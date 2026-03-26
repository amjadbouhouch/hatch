import { sql, relations } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── Workspaces ──────────────────────────────────────────────────────────────

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull().unique(),
    agentName: text("agent_name").notNull().default("Hatch"),
    description: text("description"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

// ─── Skills ──────────────────────────────────────────────────────────────────

export const skills = sqliteTable(
  "skills",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    content: text("content"),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [
    uniqueIndex("idx_skills_name_workspace").on(t.name, t.workspaceId),
  ],
);

// ─── Knowledge Bases ─────────────────────────────────────────────────────────

export const knowledgeBases = sqliteTable(
  "knowledge_bases",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    parentId: text("parent_id"),
    documentId: text("document_id"),
    status: text("status", {
      enum: ["pending", "processing", "ready", "error"],
    })
      .notNull()
      .default("pending"),
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [
    index("idx_kb_workspace").on(t.workspaceId),
    index("idx_kb_parent").on(t.parentId),
  ],
);

// ─── Embedding Configs ───────────────────────────────────────────────────────

export const embeddingConfigs = sqliteTable(
  "embedding_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    config: text("config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index("idx_embed_workspace").on(t.workspaceId)],
);

// ─── Scheduled Jobs ──────────────────────────────────────────────────────────

export const scheduledJobs = sqliteTable(
  "scheduled_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    rruleStr: text("rrule_str").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    prompt: text("prompt").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    nextRunAt: text("next_run_at"),
    mastraThreadId: text("mastra_thread_id"),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [
    index("idx_sj_workspace").on(t.workspaceId),
    index("idx_sj_next_run").on(t.nextRunAt),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  skills: many(skills),
  knowledgeBases: many(knowledgeBases),
  embeddingConfigs: many(embeddingConfigs),
  scheduledJobs: many(scheduledJobs),
}));

export const skillsRelations = relations(skills, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [skills.workspaceId],
    references: [workspaces.id],
  }),
}));

export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [knowledgeBases.workspaceId],
      references: [workspaces.id],
    }),
    parent: one(knowledgeBases, {
      fields: [knowledgeBases.parentId],
      references: [knowledgeBases.id],
      relationName: "knowledgeBaseHierarchy",
    }),
    children: many(knowledgeBases, {
      relationName: "knowledgeBaseHierarchy",
    }),
  }),
);

export const embeddingConfigsRelations = relations(
  embeddingConfigs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [embeddingConfigs.workspaceId],
      references: [workspaces.id],
    }),
  }),
);

export const scheduledJobsRelations = relations(
  scheduledJobs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [scheduledJobs.workspaceId],
      references: [workspaces.id],
    }),
  }),
);

// ─── Type Exports ────────────────────────────────────────────────────────────

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;

export type Skill = InferSelectModel<typeof skills>;
export type NewSkill = InferInsertModel<typeof skills>;

export type KnowledgeBase = InferSelectModel<typeof knowledgeBases>;
export type NewKnowledgeBase = InferInsertModel<typeof knowledgeBases>;

export type EmbeddingConfig = InferSelectModel<typeof embeddingConfigs>;
export type NewEmbeddingConfig = InferInsertModel<typeof embeddingConfigs>;

export type ScheduledJob = InferSelectModel<typeof scheduledJobs>;
export type NewScheduledJob = InferInsertModel<typeof scheduledJobs>;

