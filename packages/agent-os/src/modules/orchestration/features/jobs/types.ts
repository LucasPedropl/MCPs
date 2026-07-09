import type { BridgeProvider } from "../../client/types.js";
import type { DelegationMode } from "../../tools/delegation.js";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "awaiting_approval";

export interface CreateJobInput {
  workspace: string;
  provider: BridgeProvider;
  prompt: string;
  model?: string;
  mode?: DelegationMode;
  agenticMode?: boolean;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
  parentJobId?: string;
  idempotencyKey?: string;
}

export interface DelegationJobRow {
  id: string;
  workspace: string;
  provider: BridgeProvider;
  model: string | null;
  prompt: string;
  status: JobStatus;
  mode: string;
  agentic_mode: boolean;
  timeout_ms: number;
  response: string | null;
  error: string | null;
  session_id: string | null;
  cascade_id: string | null;
  exit_code: number | null;
  metadata: Record<string, unknown>;
  parent_job_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobEventRow {
  id: string;
  job_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface JobListFilters {
  workspace?: string;
  status?: JobStatus;
  provider?: BridgeProvider;
  limit?: number;
}

export interface JobStatusSnapshot {
  job: DelegationJobRow;
  events: JobEventRow[];
}
