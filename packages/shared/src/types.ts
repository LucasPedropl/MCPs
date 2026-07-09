export const AGENT_OS_VERSION = "0.1.0";
export const MCPS_MONOREPO_VERSION = "1.0.0";

export type BridgeProvider =
  | "antigravity"
  | "cursor"
  | "copilot"
  | "parallel"
  | "pipeline";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "awaiting_approval";

export type McpTransport = "stdio" | "http" | "openapi";

export type MemoryScope = "global" | "project";

export type AgentHost = "cursor" | "antigravity" | "claude_code" | "unknown";

export interface SkillMeta {
  name: string;
  description: string;
  version: string;
  scope: MemoryScope | "workspace";
}

export interface McpConnectionMeta {
  alias: string;
  transport: McpTransport;
  status: "connected" | "disconnected" | "error";
  toolCount?: number;
}

export interface AssembledContext {
  preferences: Array<{ key: string; value: unknown; scope: MemoryScope }>;
  decisions: Array<{ topic: string; chosen_option: string; rationale: string }>;
  pitfalls: Array<{ symptom: string; fix: string }>;
  skills: Array<{ name: string; chunk: string }>;
  playbooks: Array<{ server: string; chunk: string }>;
  schema_hints?: Array<{ table: string; columns: string[] }>;
  suggested_tools: string[];
  suggested_provider?: BridgeProvider;
  token_estimate: number;
}
