import { appendJobEvent, claimJob, getJob, listChildJobs, updateJob } from "./job-store.js";
import { moveJobToDlq } from "./job-dlq.js";
import {
  findOrphanJobIds,
  findStalledPendingJobIds,
  prepareJobRetry,
} from "./job-recovery.js";
import { executePipelineJob, resumePipelineJob } from "../pipeline/pipeline-runner.js";
import type { PipelineJobMetadata } from "../pipeline/types.js";
import { createJobChunkEmitter } from "../observability/chunk-emitter.js";
import { executeParallelJob } from "../parallel/parallel-runner.js";
import { runDelegationWithFallback } from "../../providers/fallback.js";
import { buildJobMetrics, recordJobMetrics } from "./job-metrics.js";
import type { AwaitingApprovalState } from "./job-hitl.js";
import type { DelegationJobRow } from "./types.js";
const activeJobs = new Map<string, AbortController>();

export function isJobRunning(jobId: string): boolean {
  return activeJobs.has(jobId);
}

export function cancelRunningJob(jobId: string): boolean {
  const controller = activeJobs.get(jobId);
  if (!controller) {
    return false;
  }
  controller.abort();
  activeJobs.delete(jobId);
  return true;
}

function jobToDelegationParams(job: DelegationJobRow) {
  const sessionId = job.session_id ?? (job.metadata["sessionId"] as string | undefined);
  return {
    provider: job.provider,
    prompt: job.prompt,
    model: job.model ?? undefined,
    mode: job.mode as "subagent" | "bridge" | "parallel" | "pipeline",
    agentic_mode: job.agentic_mode,
    timeout_ms: job.timeout_ms,
    session_id: sessionId,
    workspace_path: job.workspace,
  };
}

async function failJob(
  jobId: string,
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const delayMs = await prepareJobRetry(jobId, message, metadata);
  if (delayMs !== null) {
    setTimeout(() => {
      enqueueJob(jobId);
    }, delayMs);
    activeJobs.delete(jobId);
    return;
  }

  await moveJobToDlq(jobId, message);
  await updateJob(jobId, {
    status: "failed",
    error: message,
    completed_at: new Date().toISOString(),
  });
  await appendJobEvent(jobId, "error", { message });
}

async function markCancelled(jobId: string): Promise<void> {
  await updateJob(jobId, {
    status: "cancelled",
    completed_at: new Date().toISOString(),
  });
  await appendJobEvent(jobId, "status_change", { status: "cancelled" });
}

async function runPipelineJob(jobId: string, signal: AbortSignal): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    return;
  }

  const metadata = job.metadata as unknown as PipelineJobMetadata;
  const shouldResume =
    Boolean(metadata.resumeRequested) ||
    Boolean(metadata.resumeAfterApproval) ||
    (job.status === "pending" &&
      metadata.currentStepIndex !== undefined &&
      metadata.currentStepIndex >= 0);

  const startIndex = metadata.resumeAfterApproval ? metadata.approvedStepIndex : undefined;
  const pipelineResult = shouldResume
    ? metadata.resumeAfterApproval && startIndex !== undefined
      ? await executePipelineJob(jobId, startIndex, metadata.pipelineContext)
      : await resumePipelineJob(jobId)
    : await executePipelineJob(jobId);

  if (signal.aborted) {
    await markCancelled(jobId);
    return;
  }

  if (pipelineResult.status === "awaiting_approval") {
    return;
  }

  await updateJob(jobId, {
    status: pipelineResult.status === "completed" ? "completed" : "failed",
    response: pipelineResult.finalOutput,
    metadata: {
      ...metadata,
      resumeRequested: false,
      stepResults: pipelineResult.stepResults,
      failedAt: pipelineResult.failedAt,
    },
    ...(pipelineResult.status === "failed"
      ? { error: `Pipeline falhou no step ${pipelineResult.failedAt ?? "unknown"}` }
      : {}),
    completed_at: new Date().toISOString(),
  });
  await appendJobEvent(jobId, pipelineResult.status === "failed" ? "error" : "completed", {
    type: "pipeline",
    stepCount: pipelineResult.stepResults.length,
    failedAt: pipelineResult.failedAt,
    resumed: shouldResume,
  });
}

/** true se o job foi cancelado por outra instância enquanto rodávamos aqui. */
async function wasCancelledElsewhere(jobId: string): Promise<boolean> {
  try {
    const current = await getJob(jobId);
    return current?.status === "cancelled";
  } catch {
    return false;
  }
}

async function executeJob(jobId: string, signal: AbortSignal): Promise<void> {
  // Claim atômico: se outra instância (realtime worker, orphan recovery,
  // retry) já pegou este job, o UPDATE condicional retorna vazio e saímos.
  const job = await claimJob(jobId);
  if (!job) {
    return;
  }

  await appendJobEvent(jobId, "status_change", { status: "running" });

  if (signal.aborted) {
    await markCancelled(jobId);
    return;
  }

  try {
    if (job.mode === "pipeline" || job.provider === "pipeline") {
      await runPipelineJob(jobId, signal);
      return;
    }

    if (job.mode === "parallel" || job.provider === "parallel") {
      const parallelResult = await executeParallelJob(jobId, signal);

      if (signal.aborted) {
        await markCancelled(jobId);
        return;
      }
      if (await wasCancelledElsewhere(jobId)) {
        return;
      }

      const failed = parallelResult.successCount === 0;
      if (failed) {
        await failJob(jobId, "Todos os providers falharam na delegação paralela.", job.metadata);
        return;
      }

      await updateJob(jobId, {
        status: "completed",
        response: parallelResult.merged,
        completed_at: new Date().toISOString(),
      });
      await appendJobEvent(jobId, "completed", {
        type: "parallel",
        successCount: parallelResult.successCount,
        failureCount: parallelResult.failureCount,
        winnerProvider: parallelResult.winnerProvider,
        responseLength: parallelResult.merged.length,
      });
      return;
    }

    const startedAt = Date.now();
    const onChunk = createJobChunkEmitter(jobId);
    const result = await runDelegationWithFallback({
      ...jobToDelegationParams(job),
      holder_id: jobId,
      on_chunk: onChunk,
      signal,
    });

    if (signal.aborted) {
      await markCancelled(jobId);
      return;
    }
    if (await wasCancelledElsewhere(jobId)) {
      return;
    }

    if (!result.success) {
      await failJob(jobId, result.message, job.metadata);
      return;
    }

    await updateJob(jobId, {
      status: "completed",
      response: result.response,
      session_id: result.sessionId,
      cascade_id: result.cascadeId,
      exit_code: result.exitCode,
      model: result.model,
      completed_at: new Date().toISOString(),
    });
    await recordJobMetrics(
      jobId,
      buildJobMetrics({
        provider: result.provider,
        prompt: job.prompt,
        response: result.response,
        durationMs: Date.now() - startedAt,
      }),
    );
    await appendJobEvent(jobId, "completed", {
      provider: result.provider,
      mode: result.mode,
      responseLength: result.response.length,
    });
  } catch (error) {
    if (signal.aborted) {
      await markCancelled(jobId);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const current = await getJob(jobId);
    await failJob(jobId, message, current?.metadata ?? job.metadata);
  } finally {
    activeJobs.delete(jobId);
  }
}

export async function recoverOrphanJobs(): Promise<number> {
  const orphanIds = await findOrphanJobIds(isJobRunning);
  const stalledPending = await findStalledPendingJobIds(isJobRunning);
  const jobIds = [...new Set([...orphanIds, ...stalledPending])];
  for (const jobId of jobIds) {
    enqueueJob(jobId);
  }
  if (jobIds.length > 0) {
    console.error(
      `[job-runner] recovery: ${orphanIds.length} órfão(s) + ${stalledPending.length} pending parado(s) reenfileirado(s)`,
    );
  }
  return jobIds.length;
}

/** Enfileira execução em background (não bloqueia o MCP). */
export function enqueueJob(jobId: string): void {
  if (activeJobs.has(jobId)) {
    return;
  }

  const controller = new AbortController();
  activeJobs.set(jobId, controller);

  void executeJob(jobId, controller.signal).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[job-runner] job ${jobId} falhou inesperadamente:`, message);
    activeJobs.delete(jobId);
  });
}

async function cancelChildJobs(parentJobId: string): Promise<number> {
  const children = await listChildJobs(parentJobId);
  let cancelled = 0;

  for (const child of children) {
    if (child.status === "completed" || child.status === "failed" || child.status === "cancelled") {
      continue;
    }
    await cancelJob(child.id, false);
    cancelled += 1;
  }

  return cancelled;
}

/** Cancela job e filhos pendentes/em execução (pipeline/parallel). */
export async function cancelJob(
  jobId: string,
  cascade = true,
): Promise<{ job: DelegationJobRow | null; childrenCancelled: number }> {
  const job = await getJob(jobId);
  if (!job) {
    return { job: null, childrenCancelled: 0 };
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return { job, childrenCancelled: 0 };
  }

  let childrenCancelled = 0;
  if (cascade) {
    childrenCancelled = await cancelChildJobs(jobId);
  }

  cancelRunningJob(jobId);
  await markCancelled(jobId);
  const updated = await getJob(jobId);
  return { job: updated, childrenCancelled };
}

/** Reenfileira resume de pipeline assíncrono. */
export async function enqueuePipelineResume(pipelineJobId: string): Promise<void> {
  const job = await getJob(pipelineJobId);
  if (!job) {
    throw new Error(`Pipeline ${pipelineJobId} não encontrado`);
  }

  await updateJob(pipelineJobId, {
    status: "pending",
    error: null,
    started_at: null,
    completed_at: null,
    metadata: { ...job.metadata, resumeRequested: true },
  });
  await appendJobEvent(pipelineJobId, "pipeline_resume_queued", {});
  enqueueJob(pipelineJobId);
}

/** Aprova ou rejeita step pausado (HITL). */
export async function approveJobStep(
  jobId: string,
  approved: boolean,
  comment?: string,
): Promise<{ jobId: string; approved: boolean; resumed: boolean }> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado`);
  }

  if (job.status !== "awaiting_approval") {
    throw new Error(`Job ${jobId} não está aguardando aprovação (status: ${job.status})`);
  }

  const awaiting = job.metadata["awaitingApproval"] as AwaitingApprovalState | undefined;
  if (!awaiting) {
    throw new Error(`Job ${jobId} sem metadata de aprovação`);
  }

  if (!approved) {
    await updateJob(jobId, {
      status: "cancelled",
      error: comment ?? "Rejeitado pelo operador (HITL)",
      completed_at: new Date().toISOString(),
      metadata: {
        ...job.metadata,
        awaitingApproval: undefined,
        hitlRejected: true,
        hitlComment: comment,
      },
    });
    await appendJobEvent(jobId, "hitl_rejected", { comment, role: awaiting.role });
    return { jobId, approved: false, resumed: false };
  }

  await updateJob(jobId, {
    status: "pending",
    metadata: {
      ...job.metadata,
      awaitingApproval: undefined,
      hitlApproved: true,
      hitlComment: comment,
      resumeAfterApproval: true,
      approvedStepIndex: awaiting.stepIndex,
    },
  });
  await appendJobEvent(jobId, "hitl_approved", {
    comment,
    role: awaiting.role,
    stepIndex: awaiting.stepIndex,
  });
  enqueueJob(jobId);

  return { jobId, approved: true, resumed: true };
}
