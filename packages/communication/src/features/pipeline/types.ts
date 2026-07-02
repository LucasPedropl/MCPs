import type { BridgeProvider } from "../../client/types.js";

export type PipelineStepRole = "plan" | "implement" | "review" | "fix";

export type PipelineTargetProvider = Exclude<BridgeProvider, "parallel" | "pipeline">;

export interface PipelineStepConfig {
  role: PipelineStepRole;
  provider: PipelineTargetProvider;
  model?: string;
  agentic_mode?: boolean;
}

export interface PipelineStepResult {
  role: PipelineStepRole;
  provider: PipelineTargetProvider;
  status: "success" | "failed";
  output: string;
  stepJobId: string;
  durationMs: number;
  error?: string;
  validationErrors?: string[];
  loopIteration?: number;
}

export interface PromptContext {
  task: string;
  plan?: string;
  implement?: string;
  review?: string;
}

export interface PipelineRunInput {
  task: string;
  steps: PipelineStepConfig[];
  timeout_ms: number;
}

export interface PipelineRunResult {
  pipelineJobId: string;
  status: "completed" | "failed" | "awaiting_approval";
  stepResults: PipelineStepResult[];
  finalOutput: string;
  failedAt?: PipelineStepRole;
}

export interface PipelineJobMetadata {
  task: string;
  steps: PipelineStepConfig[];
  stepResults?: PipelineStepResult[];
  failedAt?: PipelineStepRole;
  currentStepIndex?: number;
  pipelineContext?: PromptContext;
  reviewFixLoops?: number;
  resumeRequested?: boolean;
  resumeAfterApproval?: boolean;
  approvedStepIndex?: number;
}
