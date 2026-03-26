import { z } from 'zod/v4';

// ─── Threads ────────────────────────────────────────────────────────────────

export const CreateThreadBody = z.object({
  workspaceId: z.string().optional(),
  title: z.string().optional(),
});

export const SendMessageBody = z.object({
  content: z.string().min(1, 'content is required'),
  threadId: z.string().optional(),
  workspaceId: z.string().optional(),
});

// ─── Messages ───────────────────────────────────────────────────────────────

export const FollowUpBody = z.object({
  content: z.string().min(1, 'content is required'),
  threadId: z.string().min(1, 'threadId is required'),
});

// ─── Control ────────────────────────────────────────────────────────────────

export const AbortBody = z.object({
  threadId: z.string().min(1, 'threadId is required'),
});

export const StatusParams = z.object({
  threadId: z.string(),
});

// ─── Thread Init ───────────────────────────────────────────────────────────

export const InitThreadBody = z.object({
  workspaceId: z.string().optional(),
});

// ─── Approvals ─────────────────────────────────────────────────────────────

export const ToolApprovalBody = z.object({
  threadId: z.string().min(1, 'threadId is required'),
  decision: z.enum(['allow', 'deny', 'always_allow_category']),
});

export const AnswerBody = z.object({
  threadId: z.string().min(1, 'threadId is required'),
  questionId: z.string().min(1, 'questionId is required'),
  answer: z.string(),
});

export const PlanApprovalBody = z.object({
  threadId: z.string().min(1, 'threadId is required'),
  planId: z.string().min(1, 'planId is required'),
  response: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CreateThreadInput = z.infer<typeof CreateThreadBody>;
export type SendMessageInput = z.infer<typeof SendMessageBody>;
export type FollowUpInput = z.infer<typeof FollowUpBody>;
export type AbortInput = z.infer<typeof AbortBody>;
export type InitThreadInput = z.infer<typeof InitThreadBody>;
export type ToolApprovalInput = z.infer<typeof ToolApprovalBody>;
export type AnswerInput = z.infer<typeof AnswerBody>;
export type PlanApprovalInput = z.infer<typeof PlanApprovalBody>;
