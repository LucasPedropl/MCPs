import * as fs from "node:fs";
import type { McpTransport } from "@mcps/shared";
import { getPresetsPath } from "../../../config/paths.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../../features/supabase-client.js";

export interface HubConnection {
  id: string;
  alias: string;
  transport: McpTransport;
  config_json: Record<string, unknown>;
  tool_cache_json: Array<{ name: string; description?: string }>;
  status: "connected" | "disconnected" | "error";
  last_health_at: string | null;
}

export async function listConnections(): Promise<HubConnection[]> {
  if (!isSupabaseConfigured()) {
    return loadLocalConnections();
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("mcp_hub_connections")
    .select("*")
    .order("alias");

  if (error) {
    // Fallback explícito: mascarar erro de credencial/RLS aqui esconderia o
    // problema real — loga e marca a origem como preset local.
    console.error(
      `[mcp-hub] listConnections falhou no Supabase (${error.message}); usando presets locais como fallback.`,
    );
    return loadLocalConnections();
  }

  return (data ?? []) as HubConnection[];
}

function loadLocalConnections(): HubConnection[] {
  const presetsPath = getPresetsPath();
  if (!fs.existsSync(presetsPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(presetsPath, "utf8")) as {
    presets?: Array<Record<string, unknown>>;
  };

  return (parsed.presets ?? []).map((preset, index) => ({
    id: `local-${index}`,
    alias: String(preset["alias"] ?? `preset-${index}`),
    transport: (preset["transport"] as McpTransport) ?? "stdio",
    config_json: (preset["config"] as Record<string, unknown>) ?? {},
    tool_cache_json: [],
    status: "disconnected",
    last_health_at: null,
  }));
}

export async function upsertConnection(input: {
  alias: string;
  transport: McpTransport;
  config: Record<string, unknown>;
}): Promise<HubConnection> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("mcp_hub_connections")
    .upsert(
      {
        alias: input.alias,
        transport: input.transport,
        config_json: input.config,
        status: "disconnected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alias" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao salvar conexão MCP: ${error.message}`);
  }

  return data as HubConnection;
}

export async function updateToolCache(
  alias: string,
  tools: Array<{ name: string; description?: string }>,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("mcp_hub_connections")
    .update({
      tool_cache_json: tools,
      status: "connected",
      last_health_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("alias", alias);

  if (error) {
    throw new Error(`Falha ao atualizar cache de tools: ${error.message}`);
  }
}

export async function updateConnectionStatus(
  alias: string,
  status: HubConnection["status"],
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("mcp_hub_connections")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("alias", alias);

  if (error) {
    throw new Error(`Falha ao atualizar status: ${error.message}`);
  }
}

export async function removeConnection(alias: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("mcp_hub_connections").delete().eq("alias", alias);

  if (error) {
    throw new Error(`Falha ao remover conexão MCP: ${error.message}`);
  }
}

export async function getConnection(alias: string): Promise<HubConnection | null> {
  const connections = await listConnections();
  return connections.find((connection) => connection.alias === alias) ?? null;
}

export async function registerPresetMcps(): Promise<{ registered: string[] }> {
  const presetsPath = getPresetsPath();
  if (!fs.existsSync(presetsPath)) {
    throw new Error(`Presets não encontrados: ${presetsPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(presetsPath, "utf8")) as {
    presets?: Array<{
      alias: string;
      transport: McpTransport;
      config: Record<string, unknown>;
    }>;
  };

  const registered: string[] = [];
  for (const preset of parsed.presets ?? []) {
    await upsertConnection({
      alias: preset.alias,
      transport: preset.transport,
      config: preset.config,
    });
    registered.push(preset.alias);
  }

  return { registered };
}
