import { updateJob, getJob } from "./job-store.js";
import type { BridgeProvider } from "../../client/types.js";

export interface JobMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  durationMs?: number;
  provider?: BridgeProvider;
}

const COST_PER_1K_TOKENS: Record<BridgeProvider, number> = {
  antigravity: 0.002,
  cursor: 0.003,
  copilot: 0.001,
  parallel: 0.002,
  pipeline: 0.002,
};

/** Estima tokens (~4 chars/token). */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/** Calcula métricas estimadas a partir de prompt/resposta. */
export function buildJobMetrics(params: {
  provider: BridgeProvider;
  prompt: string;
  response: string;
  durationMs: number;
}): JobMetrics {
  const promptTokens = estimateTokens(params.prompt);
  const completionTokens = estimateTokens(params.response);
  const totalTokens = promptTokens + completionTokens;
  const rate = COST_PER_1K_TOKENS[params.provider] ?? 0.002;

  return {
    provider: params.provider,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: Number(((totalTokens / 1000) * rate).toFixed(6)),
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

