export interface CachedTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HubConnection {
  id: string;
  alias: string;
  transport: string;
  status: string;
  last_health_at: string | null;
  config_json: Record<string, unknown>;
  tool_cache_json: CachedTool[];
}

export interface McpServerSummary {
  id: string;
  name: string;
  swagger_url: string;
  api_base_url: string;
  auth_type: string;
  created_at: string;
}

export interface HubResponse {
  configured: boolean;
  connections: HubConnection[];
  mcp_servers?: McpServerSummary[];
}
