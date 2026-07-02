import { getSupabaseClient } from "../jobs/supabase-client.js";
import type { HealthListFilters, HealthSnapshotRow, RecordHealthInput } from "./types.js";

function mapRow(row: Record<string, unknown>): HealthSnapshotRow {
  return {
    id: String(row["id"]),
    workspace: String(row["workspace"]),
    provider: row["provider"] as HealthSnapshotRow["provider"],
    status: String(row["status"]),
    latency_ms: row["latency_ms"] != null ? Number(row["latency_ms"]) : null,
    detail: (row["detail"] as Record<string, unknown>) ?? {},
    created_at: String(row["created_at"]),
  };
}

export async function recordHealthSnapshot(input: RecordHealthInput): Promise<HealthSnapshotRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("provider_health_snapshots")
    .insert({
      workspace: input.workspace,
      provider: input.provider,
      status: input.status,
      latency_ms: input.latencyMs ?? null,
      detail: input.detail ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao gravar health snapshot");
  }

  return mapRow(data as Record<string, unknown>);
}

export async function listHealthSnapshots(
  filters: HealthListFilters = {},
): Promise<HealthSnapshotRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("provider_health_snapshots")
    .select()
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 30);

  if (filters.workspace) {
    query = query.eq("workspace", filters.workspace);
  }
  if (filters.provider) {
    query = query.eq("provider", filters.provider);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}
