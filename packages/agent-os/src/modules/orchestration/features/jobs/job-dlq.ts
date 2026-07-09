import { getSupabaseClient } from "./supabase-client.js";
import { appendJobEvent, getJob, updateJob, mapJobRow } from "./job-store.js";
import type { DelegationJobRow, JobListFilters } from "./types.js";

/**
 * Marca um job como falho (failed) e o move para a Dead Letter Queue (DLQ).
 * 
 * @param jobId ID do job a ser movido
 * @param reason Motivo do envio para a DLQ
 */
export async function moveJobToDlq(jobId: string, reason: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado ao tentar mover para DLQ`);
  }

  const updatedMetadata = {
    ...job.metadata,
    inDlq: true,
    dlqReason: reason,
    dlqAt: new Date().toISOString(),
  };

  await updateJob(jobId, {
    status: "failed",
    metadata: updatedMetadata,
  });

  await appendJobEvent(jobId, "moved_to_dlq", { reason });
}

/**
 * Lista jobs que estão na DLQ (Dead Letter Queue).
 * 
 * @param filters Filtros opcionais de listagem
 */
export async function listDlqJobs(filters: JobListFilters = {}): Promise<DelegationJobRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("delegation_jobs")
    .select()
    .contains("metadata", { inDlq: true })
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 20);

  if (filters.workspace) {
    query = query.eq("workspace", filters.workspace);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.provider) {
    query = query.eq("provider", filters.provider);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? "Falha ao listar jobs na DLQ do Supabase");
  }

  return (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>));
}
