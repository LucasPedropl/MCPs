import { getSupabaseClient } from "../../features/supabase-client.js";

export interface McpServerRecord {  id: string;
  name: string;
  swagger_url: string;
  api_base_url: string;
  auth_type: string;
  auth_credentials: Record<string, unknown>;
  created_at?: string;
}

export interface McpToolRecord {
  id: string;
  server_id: string;
  original_name: string;
  custom_name: string;
  custom_description: string;
  http_method: string;
  endpoint_path: string;
  parameters_schema: Record<string, unknown>;
  category_id?: string | null;
}

export async function listMcpServers(): Promise<McpServerRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("mcp_servers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar servidores MCP: ${error.message}`);
  }

  return (data ?? []) as McpServerRecord[];
}

export async function getMcpServerById(serverId: string): Promise<McpServerRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("mcp_servers")
    .select("*")
    .eq("id", serverId)
    .single();

  if (error || !data) {
    throw new Error(`Servidor MCP ${serverId} não encontrado.`);
  }

  return data as McpServerRecord;
}

export async function createMcpServer(input: {
  name: string;
  swagger_url: string;
  api_base_url: string;
  auth_type?: string;
  auth_credentials?: Record<string, unknown>;
}): Promise<McpServerRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("mcp_servers")
    .insert([
      {
        name: input.name,
        swagger_url: input.swagger_url,
        api_base_url: input.api_base_url,
        auth_type: input.auth_type ?? "none",
        auth_credentials: input.auth_credentials ?? {},
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar servidor MCP: ${error?.message}`);
  }

  return data as McpServerRecord;
}

export async function getToolsByServerId(serverId: string): Promise<McpToolRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("mcp_tools").select("*").eq("server_id", serverId);
  if (error) throw new Error(`Falha ao buscar tools do servidor: ${error.message}`);
  return (data ?? []) as McpToolRecord[];
}

export async function insertToolsBatch(tools: Array<Record<string, unknown>>): Promise<McpToolRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("mcp_tools").insert(tools).select();
  if (error) throw new Error(`Falha ao inserir tools em lote: ${error.message}`);
  return (data ?? []) as McpToolRecord[];
}

export async function saveSyncReport(input: {
  server_id: string;
  report_summary: string;
  added_endpoints: unknown[];
  modified_endpoints: unknown[];
  removed_endpoints: unknown[];
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("mcp_sync_reports").insert([input]);
  if (error) throw new Error(`Falha ao salvar relatório de sync: ${error.message}`);
}
