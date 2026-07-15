import { estimateTokens } from "@mcps/shared";
import { updateJob, getJob } from "./job-store.js";
import type { BridgeProvider } from "../../client/types.js";

export interface JobMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  provider?: BridgeProvider;
}

/**
 * Calcula métricas estimadas a partir de prompt/resposta.
 * Sem custo em USD: Antigravity/Cursor são assinatura — qualquer valor seria inventado.
 */
export function buildJobMetrics(params: {
  provider: BridgeProvider;
  prompt: string;
  response: string;
  durationMs: number;
}): JobMetrics {
  const promptTokens = estimateTokens(params.prompt);
  const completionTokens = estimateTokens(params.response);

  return {
    provider: params.provider,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    durationMs: params.durationMs,
  };
}

/** Grava métricas no metadata.metrics do job. */
export async function recordJobMetrics(jobId: string, metrics: JobMetrics): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado ao tentar gravar métricas.`);
  }

  const currentMetadata = job.metadata ?? {};
  const currentMetrics = (currentMetadata["metrics"] as JobMetrics | undefined) ?? {};

  await updateJob(jobId, {
    metadata: {
      ...currentMetadata,
      metrics: { ...currentMetrics, ...metrics },
    },
  });
}

/** Lê métricas do job. */
export async function getJobMetrics(jobId: string): Promise<JobMetrics | null> {
  const job = await getJob(jobId);
  if (!job) {
    return null;
  }
  return (job.metadata["metrics"] as JobMetrics | undefined) ?? null;
}

