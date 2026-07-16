import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../features/supabase-client.js";
import type { ToolEventInput, ToolEventRow } from "./types.js";

/** Insert fire-and-forget-safe: nunca propaga erro para o caller da tool. */
export async function recordToolEvent(event: ToolEventInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.from("agent_tool_events").insert({
      tool_name: event.tool_name,
      host: event.host,
      ok: event.ok,
      duration_ms: event.duration_ms,
      module: event.module,
      meta: event.meta,
    });
    if (error) {
      console.error(`[agent-os] telemetria insert falhou: ${error.message}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[agent-os] telemetria insert falhou: ${message}`);
  }
}

export async function fetchToolEvents(params: {
  sinceIso: string;
  host?: string;
  limit?: number;
}): Promise<ToolEventRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const client = getSupabaseClient();
  let query = client
    .from("agent_tool_events")
    .select("tool_name, host, ok, duration_ms, module, meta, created_at")
    .gte("created_at", params.sinceIso)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 10_000);

  if (params.host) {
    query = query.eq("host", params.host);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao ler agent_tool_events: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    tool_name: String(row.tool_name),
    host: String(row.host),
    ok: Boolean(row.ok),
    duration_ms:
      typeof row.duration_ms === "number" ? row.duration_ms : null,
    module: typeof row.module === "string" ? row.module : null,
    meta:
      row.meta && typeof row.meta === "object"
        ? (row.meta as ToolEventRow["meta"])
        : {},
    created_at: String(row.created_at),
  }));
}
