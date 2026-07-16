export interface HostUsageRow {
  host: string;
  calls: number;
  errors: number;
  pct: number;
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

export interface ToolDocEntry {
  summary: string;
  full: string;
}

export interface UsagePayload {
  configured: boolean;
  success?: boolean;
  message?: string;
  window?: { since: string; until: string; days: number };
  summary?: {
    total_calls: number;
    error_rate: number;
    coverage: number;
    registered_tools: number;
    touched_tools: number;
    by_host: HostUsageRow[];
  };
  top_tools?: ToolUsageRow[];
  never_used?: string[];
  proxies?: ProxyUsageRow[];
  tool_docs?: Record<string, ToolDocEntry>;
}

export type UsageDays = 7 | 30 | 90;
export type UsageHostFilter = '' | 'cursor' | 'antigravity' | 'claude_code' | 'unknown';
