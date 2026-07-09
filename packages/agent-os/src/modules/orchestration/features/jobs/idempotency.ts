import { getSupabaseClient } from "./supabase-client.js";
import type { DelegationJobRow } from "./types.js";
import { mapJobRow } from "./job-store.js";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

/** Busca job existente pela chave de idempotência (evita duplicatas em retries). */
export async function findJobByIdempotencyKey(
  workspace: string,
  key: string,
): Promise<DelegationJobRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_jobs")
    .select()
    .eq("workspace", workspace)
    .eq("metadata->>idempotency_key", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[idempotency] lookup falhou: ${error.message}`);
    return null;
  }

  return data ? mapJobRow(data as Record<string, unknown>) : null;
}

/** Retorna job reutilizável se idempotency_key já foi processado com sucesso. */
export function isIdempotentReuse(job: DelegationJobRow): boolean {
  return job.status === "completed" || job.status === "running" || job.status === "pending";
}

export { TERMINAL_STATUSES };
