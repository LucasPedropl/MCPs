import { appendJobEvent, listJobs, updateJob } from "./job-store.js";
import { isSupabaseConfigured } from "./supabase-client.js";
import { moveJobToDlq } from "./job-dlq.js";

const DEFAULT_MAX_RETRIES = 3;

export function getMaxJobRetries(): number {
  const raw = process.env["BRIDGE_JOB_MAX_RETRIES"];
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

/** IDs de jobs `running` que não estão ativos no processo local. */
export async function findOrphanJobIds(isActive: (jobId: string) => boolean): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const running = await listJobs({ status: "running", limit: 100 });
  const orphanIds: string[] = [];

  for (const job of running) {
    if (isActive(job.id)) {
      continue;
    }
    await updateJob(job.id, {
      status: "pending",
      started_at: null,
      metadata: {
        ...job.metadata,
        orphanRecovered: true,
        orphanRecoveredAt: new Date().toISOString(),
      },
    });
    await appendJobEvent(job.id, "orphan_recovery", {
      previousStatus: "running",
      reason: "mcp_restart",
    });
    orphanIds.push(job.id);
  }

  return orphanIds;
}
