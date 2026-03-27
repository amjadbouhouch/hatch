/**
 * Type-safe API types derived from the gateway's route chain.
 *
 * All types are inferred from Hono's RPC contract — never manually defined.
 * If the backend changes, these update automatically at compile time.
 */
import type { hc, InferResponseType, InferRequestType } from 'hono/client';
import type { StatusCode } from 'hono/utils/http-status';
import type { AppType } from '@hatch/gateway/app-type';

// ─── Client Type ────────────────────────────────────────────────────────────

/** The Hono RPC client type, derived from AppType */
export type Client = ReturnType<typeof hc<AppType>>;

// ─── Generic Helpers ────────────────────────────────────────────────────────

/** Extract the JSON response type from any Hono RPC endpoint */
export type ApiResponse<T, S extends StatusCode = 200> = InferResponseType<T, S>;

/** Extract the request input type from any Hono RPC endpoint */
export type ApiInput<T> = InferRequestType<T>;

// ─── Health ─────────────────────────────────────────────────────────────────

export type HealthResponse = ApiResponse<Client['health']['$get']>;

// ─── Workspaces ─────────────────────────────────────────────────────────────

export type WorkspaceList = ApiResponse<Client['workspaces']['$get']>;
export type Workspace = WorkspaceList[number];
export type CreateWorkspaceInput = ApiInput<Client['workspaces']['$post']>['json'];
export type CreateWorkspaceResponse = ApiResponse<Client['workspaces']['$post'], 201>;

// ─── Threads ────────────────────────────────────────────────────────────────

export type ThreadList = ApiResponse<Client['threads']['$get']>;
export type ThreadStatus = ApiResponse<Client['status'][':threadId']['$get']>;
export type CreateThreadInput = ApiInput<Client['threads']['$post']>['json'];
export type CreateThreadResponse = ApiResponse<Client['threads']['$post']>;
export type SendMessageInput = ApiInput<Client['send']['$post']>['json'];
export type SendMessageResponse = ApiResponse<Client['send']['$post']>;
export type AbortResponse = ApiResponse<Client['abort']['$post']>;

// ─── Schedules ──────────────────────────────────────────────────────────────

export type ScheduleList = ApiResponse<Client['schedules'][':workspaceId']['$get']>;
export type Schedule = ScheduleList[number];
export type ToggleScheduleInput = ApiInput<Client['schedules']['toggle']['$post']>['json'];
export type ToggleScheduleResponse = ApiResponse<Client['schedules']['toggle']['$post']>;
export type DeleteScheduleInput = ApiInput<Client['schedules']['delete']['$post']>['json'];

// ─── Skills ─────────────────────────────────────────────────────────────────

export type BrowseSkillsResponse = ApiResponse<Client['skills']['browse']['$get']>;
export type BrowseSkill = BrowseSkillsResponse['skills'][number];
export type SearchSkillsResponse = ApiResponse<Client['skills']['search']['$get']>;
export type SkillSourcesResponse = ApiResponse<Client['skills']['sources']['$get']>;
export type SkillSource = SkillSourcesResponse['sources'][number];
export type SkillContent = ApiResponse<Client['skills']['content'][':owner'][':repo'][':skillId']['$get']>;
export type InstalledSkillList = ApiResponse<Client['skills']['installed'][':workspaceId']['$get']>;
export type InstalledSkill = InstalledSkillList[number];
export type InstalledSkillContent = ApiResponse<Client['skills']['installed'][':workspaceId'][':skillId']['content']['$get']>;
export type InstallSkillInput = ApiInput<Client['skills']['install']['$post']>['json'];
export type UninstallSkillInput = ApiInput<Client['skills']['uninstall']['$post']>['json'];

// ─── Knowledge ──────────────────────────────────────────────────────────────

export type KnowledgeTree = ApiResponse<Client['knowledge'][':workspaceId']['tree']['$get']>;
export type FilePreview = ApiResponse<Client['knowledge'][':workspaceId']['file'][':path{.+}']['$get']>;
export type UploadResponse = ApiResponse<Client['knowledge'][':workspaceId']['upload']['$post']>;
export type UploadResult = UploadResponse['results'][number];

// ─── Model Config ───────────────────────────────────────────────────────────

export type ModelConfig = ApiResponse<Client['configs']['model'][':workspaceId']['$get']>;
export type SaveModelConfigInput = ApiInput<Client['configs']['model']['$put']>['json'];

// ─── Vision Config ──────────────────────────────────────────────────────────

export type VisionConfig = ApiResponse<Client['configs']['vision'][':workspaceId']['$get']>;
export type SaveVisionConfigInput = ApiInput<Client['configs']['vision']['$put']>['json'];

// ─── Embedding Config ───────────────────────────────────────────────────────

export type EmbeddingConfig = ApiResponse<Client['configs']['embedding'][':workspaceId']['$get']>;
export type SaveEmbeddingConfigInput = ApiInput<Client['configs']['embedding']['$put']>['json'];
