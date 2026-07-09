export interface AntigravityInstance {
  pid: number;
  port: number;
  csrfToken: string;
  workspace: string;
  workspacePath?: string;
  extensionServerPort: number;
  httpsServerPort?: number;
  secure?: boolean;
}

export type ModelEnum =
  | "MODEL_PLACEHOLDER_M37"
  | "MODEL_PLACEHOLDER_M36"
  | "MODEL_PLACEHOLDER_M18"
  | "MODEL_PLACEHOLDER_M35"
  | "MODEL_PLACEHOLDER_M26"
  | "MODEL_CLAUDE_4_5_SONNET"
  | "MODEL_CLAUDE_4_5_SONNET_THINKING"
  | "MODEL_OPENAI_GPT_OSS_120B_MEDIUM"
  | string;

export interface CascadeConversationalConfig {
  agenticMode?: boolean;
  plannerMode?: "DEFAULT" | "PLANNING_ON" | "PLANNING_OFF";
}

export interface ModelOrAlias {
  model?: ModelEnum;
  alias?: string;
}

export interface CascadePlannerConfig {
  planModel: ModelEnum;
  conversational?: CascadeConversationalConfig;
  maxOutputTokens?: number;
  requestedModel?: ModelOrAlias;
}

export interface CheckpointConfig {
  maxOutputTokens?: number;
  enabled?: boolean;
}

export interface CascadeConfig {
  plannerConfig: CascadePlannerConfig;
  checkpointConfig?: CheckpointConfig;
  applyModelDefaultOverride?: boolean;
}

export interface StartCascadeResponse {
  cascadeId: string;
}

export interface SendUserCascadeMessageResponse {
  queued: boolean;
}

export interface PlannerResponse {
  response: string;
  modifiedResponse?: string;
  messageId?: string;
}

export interface CascadeStep {
  type: string;
  plannerResponse?: PlannerResponse;
  metadata?: {
    generatorModel?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface GetCascadeTrajectoryStepsResponse {
  steps: CascadeStep[];
}

export interface ConnectError {
  code: string;
  message: string;
  details?: unknown[];
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  agenticMode?: boolean;
  onProgress?: (partial: { response: string; stepCount: number }) => void | Promise<void>;
}

export type DelegationMode = "subagent" | "bridge" | "parallel" | "pipeline";

export type BridgeProvider = "antigravity" | "cursor" | "copilot" | "parallel" | "pipeline";

export const MODEL_LABELS: Record<string, string> = {
  MODEL_PLACEHOLDER_M16: "Gemini 3.1 Pro (High)",
  MODEL_PLACEHOLDER_M36: "Gemini 3.1 Pro (Low)",
  MODEL_PLACEHOLDER_M20: "Gemini 3.5 Flash (Medium)",
  MODEL_PLACEHOLDER_M132: "Gemini 3.5 Flash (High)",
  MODEL_PLACEHOLDER_M187: "Gemini 3.5 Flash (Low)",
  MODEL_PLACEHOLDER_M37: "Gemini 3.1 Pro (High) [legacy id]",
  MODEL_PLACEHOLDER_M18: "Gemini 3 Flash [legacy id]",
  MODEL_PLACEHOLDER_M35: "Claude Sonnet 4.6 (Thinking)",
  MODEL_PLACEHOLDER_M26: "Claude Opus 4.6 (Thinking)",
  MODEL_CLAUDE_4_5_SONNET: "Claude Sonnet 4.5",
  MODEL_CLAUDE_4_5_SONNET_THINKING: "Claude Sonnet 4.5 (Thinking)",
  MODEL_OPENAI_GPT_OSS_120B_MEDIUM: "GPT-OSS 120B (Medium)",
};

export const DEFAULT_ANTIGRAVITY_MODEL = "MODEL_PLACEHOLDER_M16";

export const KNOWN_MODELS = Object.keys(MODEL_LABELS);
