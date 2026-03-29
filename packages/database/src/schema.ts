import { sql, relations } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
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
    projectPath: text("project_path"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

// ─── Workspace Modes ────────────────────────────────────────────────────────

export const workspaceModes = sqliteTable(
  "workspace_modes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    modeId: text("mode_id").notNull(),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    color: text("color"),
    model: text("model"),
    prompt: text("prompt"),
    sortOrder: integer("sort_order").notNull().default(0),
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
    uniqueIndex("idx_modes_workspace_mode").on(t.workspaceId, t.modeId),
    index("idx_modes_workspace").on(t.workspaceId),
  ],
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

// ─── Model Configs ──────────────────────────────────────────────────────────

export const modelConfigs = sqliteTable(
  "model_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    model: text("model"),
    apiKey: text("api_key"),
    temperature: real("temperature"),
    topP: real("top_p"),
    topK: integer("top_k"),
    maxTokens: integer("max_tokens"),
    maxRetries: integer("max_retries").default(3),
    seed: integer("seed"),
    frequencyPenalty: real("frequency_penalty"),
    presencePenalty: real("presence_penalty"),
    providerOptions: text("provider_options", { mode: "json" })
      .$type<Record<string, unknown>>(),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

// ─── Vision Configs ─────────────────────────────────────────────────────────

export const visionConfigs = sqliteTable(
  "vision_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    model: text("model"),
    apiKey: text("api_key"),
    maxTokens: integer("max_tokens"),
    providerOptions: text("provider_options", { mode: "json" })
      .$type<Record<string, unknown>>(),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

// ─── Telegram Configs ───────────────────────────────────────────────────────

export const telegramConfigs = sqliteTable(
  "telegram_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    botToken: text("bot_token").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    pollingInterval: integer("polling_interval").default(5000),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

// ─── Discord Configs ─────────────────────────────────────────────────────────

export const discordConfigs = sqliteTable(
  "discord_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    botToken: text("bot_token").notNull(),
    applicationId: text("application_id").notNull(),
    publicKey: text("public_key"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    pollingInterval: integer("polling_interval").default(5000),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
);

// ─── Embedding Configs ──────────────────────────────────────────────────────

export const embeddingConfigs = sqliteTable(
  "embedding_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    model: text("model"),
    apiKey: text("api_key"),
    dimension: integer("dimension"),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
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
    lastRunAt: text("last_run_at"),
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

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  modes: many(workspaceModes),
  skills: many(skills),
  knowledgeBases: many(knowledgeBases),
  modelConfig: one(modelConfigs),
  visionConfig: one(visionConfigs),
  embeddingConfig: one(embeddingConfigs),
  scheduledJobs: many(scheduledJobs),
  telegramConfig: one(telegramConfigs),
  discordConfig: one(discordConfigs),
}));

export const workspaceModesRelations = relations(workspaceModes, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceModes.workspaceId],
    references: [workspaces.id],
  }),
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

export const modelConfigsRelations = relations(
  modelConfigs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [modelConfigs.workspaceId],
      references: [workspaces.id],
    }),
  }),
);

export const visionConfigsRelations = relations(
  visionConfigs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [visionConfigs.workspaceId],
      references: [workspaces.id],
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

export const telegramConfigsRelations = relations(
  telegramConfigs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [telegramConfigs.workspaceId],
      references: [workspaces.id],
    }),
  }),
);

export const discordConfigsRelations = relations(
  discordConfigs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [discordConfigs.workspaceId],
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

export type WorkspaceMode = InferSelectModel<typeof workspaceModes>;
export type NewWorkspaceMode = InferInsertModel<typeof workspaceModes>;

export type Skill = InferSelectModel<typeof skills>;
export type NewSkill = InferInsertModel<typeof skills>;

export type KnowledgeBase = InferSelectModel<typeof knowledgeBases>;
export type NewKnowledgeBase = InferInsertModel<typeof knowledgeBases>;

export type ModelConfig = InferSelectModel<typeof modelConfigs>;
export type NewModelConfig = InferInsertModel<typeof modelConfigs>;

export type VisionConfig = InferSelectModel<typeof visionConfigs>;
export type NewVisionConfig = InferInsertModel<typeof visionConfigs>;

export type EmbeddingConfig = InferSelectModel<typeof embeddingConfigs>;
export type NewEmbeddingConfig = InferInsertModel<typeof embeddingConfigs>;

export type ScheduledJob = InferSelectModel<typeof scheduledJobs>;
export type NewScheduledJob = InferInsertModel<typeof scheduledJobs>;

export type TelegramConfig = InferSelectModel<typeof telegramConfigs>;
export type NewTelegramConfig = InferInsertModel<typeof telegramConfigs>;

export type DiscordConfig = InferSelectModel<typeof discordConfigs>;
export type NewDiscordConfig = InferInsertModel<typeof discordConfigs>;

