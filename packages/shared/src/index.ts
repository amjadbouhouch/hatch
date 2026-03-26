export const HATCH_VERSION = "0.0.0" as const;

export {
  CreateThreadBody,
  SendMessageBody,
  FollowUpBody,
  AbortBody,
  StatusParams,
  InitThreadBody,
  ToolApprovalBody,
  AnswerBody,
  PlanApprovalBody,
} from "./schemas.js";

export type {
  CreateThreadInput,
  SendMessageInput,
  FollowUpInput,
  AbortInput,
  InitThreadInput,
  ToolApprovalInput,
  AnswerInput,
  PlanApprovalInput,
} from "./schemas.js";

export type {
  TokenUsage,
  HarnessThread,
  HarnessMessage,
  HarnessMessageContent,
  WorkspaceStatus,
  HarnessDisplayState,
  HarnessEvent,
  HarnessEventListener,
} from "./harness-types.js";
