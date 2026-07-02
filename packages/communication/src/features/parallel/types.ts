import type { BridgeProvider } from "../../client/types.js";

export type MergeStrategy = "raw_all" | "best_of" | "consensus";

export type PromptCategory = "review" | "implement" | "explain" | "general";

export type ParallelTargetProvider = Exclude<BridgeProvider, "parallel" | "pipeline">;

export interface ParallelProviderSpec {
  provider: ParallelTargetProvider;
  model?: string;
  agentic_mode?: boolean;
  mode?: "subagent" | "bridge";
}

export interface ParallelDelegateInput {
  prompt: string;
  providers: ParallelProviderSpec[];
  mergeStrategy: MergeStrategy;
  timeout_ms: number;
}

export interface ParallelProviderResult {
  provider: ParallelTargetProvider;
  success: boolean;
  response?: string;
  error?: string;
  model?: string;
  sessionId?: string;
  cascadeId?: string;
  exitCode?: number;
  durationMs: number;
}

export interface ParallelMergeResult {
  strategy: MergeStrategy;
  merged: string;
  providerResults: ParallelProviderResult[];
  winnerProvider?: ParallelTargetProvider;
  consensusScore?: number;
  successCount: number;
  failureCount: number;
}
