import { agentOsEnv } from "../../../../config/env.js";
import {
  appendJobEvent,
  listJobs,
  resetStaleRunningJob,
  updateJob,
} from "./job-store.js";
import { isSupabaseConfigured } from "./supabase-client.js";
import { moveJobToDlq } from "./job-dlq.js";

const DEFAULT_MAX_RETRIES = 3;

export function getMaxJobRetries(): number {
  const raw = agentOsEnv("JOB_MAX_RETRIES");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX_RETRIES;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RETRIES;
}

export function isRetryableError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("authentication required") || lower.includes("not logged in")) {
    return false;
  }
  if (lower.includes("cancelled") || lower.includes("cancelado")) {
    return false;
  }
  return /timeout|econnreset|enotfound|network|temporarily|503|502|429|polling timeout/i.test(
    message,
  );
}

export function computeRetryDelayMs(attempt: number): number {
  const base = 2_000;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(base * 2 ** attempt + jitter, 30_000);
}

export function getJobRetryCount(metadata: Record<string, unknown>): number {
  return Number(metadata["retryCount"] ?? 0);
}

/** Marca job para retry e retorna delay antes de reenfileirar. */
export async function prepareJobRetry(
  jobId: string,
  errorMessage: string,
  metadata: Record<string, unknown>,
): Promise<number | null> {
  const retryCount = getJobRetryCount(metadata);
  const maxRetries = Number(metadata["maxRetries"] ?? getMaxJobRetries());

  if (retryCount >= maxRetries || !isRetryableError(errorMessage)) {
    if (retryCount >= maxRetries) {
      await moveJobToDlq(jobId, `Max retries (${maxRetries}) exceeded: ${errorMessage}`);
    }
    return null;
  }

  const nextAttempt = retryCount + 1;
  const delayMs = computeRetryDelayMs(retryCount);

  await updateJob(jobId, {
    status: "pending",
    error: null,
    started_at: null,
    metadata: { ...metadata, retryCount: nextAttempt, lastRetryError: errorMessage },
  });
  await appendJobEvent(jobId, "retry_scheduled", {
    attempt: nextAttempt,
    maxRetries,
    delayMs,
    error: errorMessage,
  });

  return delayMs;
}

function orphanStaleMs(timeoutMs: number): number {
  return Math.max((timeoutMs || 120_000) * 2, 10 * 60_000);
}

/**
 * IDs de jobs `running` órfãos. Um job só é considerado órfão quando não está
 * ativo neste processo E started_at excedeu 2× o timeout do job (mín. 10min) —
 * jobs recentes podem estar rodando em OUTRA instância do agent-os e não devem
 * ser roubados. O reset é atômico (condicionado a status/started_at no banco).
 */
export async function findOrphanJobIds(isActive: (jobId: string) => boolean): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const running = await listJobs({ status: "running", limit: 100 });
  const orphanIds: string[] = [];
  const now = Date.now();

  for (const job of running) {
    if (isActive(job.id)) {
      continue;
    }

    const staleMs = orphanStaleMs(job.timeout_ms);
    const startedAt = job.started_at ? Date.parse(job.started_at) : NaN;
    if (Number.isFinite(startedAt) && now - startedAt < staleMs) {
      continue;
    }

    const cutoffIso = new Date(now - staleMs).toISOString();
    const reset = await resetStaleRunningJob(job.id, cutoffIso);
    if (!reset) {
      continue;
    }

    await updateJob(job.id, {
      metadata: {
        ...job.metadata,
        orphanRecovered: true,
        orphanRecoveredAt: new Date().toISOString(),
      },
    });
    await appendJobEvent(job.id, "orphan_recovery", {
      previousStatus: "running",
      reason: "stale_running_job",
    });
    orphanIds.push(job.id);
  }

  return orphanIds;
}

/**
 * IDs de jobs `pending` parados há mais de 2min e não ativos localmente —
 * cobre retries agendados via setTimeout que se perderam quando o processo
 * morreu. Reenfileirar é seguro: o claim atômico impede execução dupla.
 */
export async function findStalledPendingJobIds(
  isActive: (jobId: string) => boolean,
): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const pending = await listJobs({ status: "pending", limit: 100 });
  const cutoff = Date.now() - 2 * 60_000;

  return pending
    .filter((job) => !isActive(job.id))
    .filter((job) => {
      const createdAt = Date.parse(job.created_at);
      return Number.isFinite(createdAt) && createdAt < cutoff;
    })
    .map((job) => job.id);
}
