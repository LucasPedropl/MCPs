import type { AgentOsHost } from "../../config/env.js";

export interface ToolEventMeta {
  alias?: string;
  child_tool?: string;
}

export interface ToolEventInput {
  tool_name: string;
  host: AgentOsHost;
  ok: boolean;
  duration_ms: number | null;
  module: string | null;
  meta: ToolEventMeta;
}

export interface ToolEventRow {
  tool_name: string;
  host: string;
  ok: boolean;
  duration_ms: number | null;
  module: string | null;
  meta: ToolEventMeta;
  created_at: string;
}

export interface ToolUsageRow {
  tool_name: string;
  calls: number;
  errors: number;
  avg_ms: number | null;
  pct: number;
}

export interface ProxyUsageRow {
  tool_name: string;
  alias: string | null;
  child_tool: string | null;
  calls: number;
  errors: number;
}

export interface HostUsageRow {
  host: string;
  calls: number;
  errors: number;
  pct: number;
}

export interface UsageReport {
  window: { since: string; until: string; days: number };
  summary: {
    total_calls: number;
    error_rate: number;
    coverage: number;
    registered_tools: number;
    touched_tools: number;
    by_host: HostUsageRow[];
  };
  top_tools: ToolUsageRow[];
  never_used: string[];
  proxies: ProxyUsageRow[];
}
