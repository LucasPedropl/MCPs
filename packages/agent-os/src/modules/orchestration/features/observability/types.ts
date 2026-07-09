import type { BridgeProvider } from "../../client/types.js";

export type HealthProvider = Exclude<BridgeProvider, "parallel" | "pipeline">;

export interface HealthSnapshotRow {
  id: string;
  workspace: string;
  provider: HealthProvider;
  status: string;
  latency_ms: number | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface RecordHealthInput {
  workspace: string;
  provider: HealthProvider;
  status: string;
  latencyMs?: number;
  detail?: Record<string, unknown>;
}

export interface HealthListFilters {
  workspace?: string;
  provider?: HealthProvider;
  limit?: number;
}

export interface JobChunkEvent {
  seq: number;
  text: string;
  created_at: string;
  accumulatedLength?: number;
}
