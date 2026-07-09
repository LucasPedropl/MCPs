import { runDelegation } from "../../tools/delegation.js";
import { isAntigravityParallelEnabled } from "../../providers/antigravity/config.js";
import {
  appendJobEvent,
  createJob,
  getJob,
  updateJob,
} from "../jobs/job-store.js";
import { mergeParallelResults } from "./merge.js";
import type {
  MergeStrategy,
  ParallelDelegateInput,
  ParallelMergeResult,
  ParallelProviderResult,
  ParallelProviderSpec,
} from "./types.js";

async function runSingleProvider(
  spec: ParallelProviderSpec,
  prompt: string,
  timeout_ms: number,
  lockHolderId: string,
): Promise<ParallelProviderResult> {
  const started = Date.now();

  try {
    const result = await runDelegation({
      provider: spec.provider,
      prompt,
      model: spec.model,
      mode: spec.mode ?? "subagent",
      agentic_mode: spec.agentic_mode ?? false,
      timeout_ms,
      holder_id: `${lockHolderId}:${spec.provider}`,
    });

    if (!result.success) {
      return {
        provider: spec.provider,
        success: false,
        error: result.message,
        durationMs: Date.now() - started,
      };
    }

    return {
      provider: spec.provider,
      success: true,
      response: result.response,
      model: result.model,
      sessionId: result.sessionId,
      cascadeId: result.cascadeId,
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      provider: spec.provider,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}

function canRunAgenticInParallel(providers: ParallelProviderSpec[]): boolean {
  return providers.every((spec) => {
    if (!spec.agentic_mode) {
      return true;
    }
    if (spec.provider === "antigravity") {
      return isAntigravityParallelEnabled();
    }
    return true;
  });
}

function hasAgenticProvider(specs: ParallelProviderSpec[]): boolean {
  return specs.some((spec) => spec.agentic_mode === true);
}

/** Executa providers em paralelo ou sequencial se agentic no workspace principal. */
async function runAllProviders(
  providers: ParallelProviderSpec[],
  prompt: string,
  timeout_ms: number,
  lockHolderId: string,
): Promise<ParallelProviderResult[]> {
  const agentic = hasAgenticProvider(providers);
  if (agentic && !canRunAgenticInParallel(providers)) {
    const results: ParallelProviderResult[] = [];
    for (const spec of providers) {
      results.push(await runSingleProvider(spec, prompt, timeout_ms, lockHolderId));
    }
    return results;
  }

  return Promise.all(
    providers.map((spec) => runSingleProvider(spec, prompt, timeout_ms, lockHolderId)),
  );
}

/** Executa delegação paralela síncrona para N providers. */
export async function runParallelDelegation(
  input: ParallelDelegateInput,
): Promise<ParallelMergeResult> {
  if (input.providers.length === 0) {
    throw new Error("Pelo menos um provider é necessário para delegação paralela.");
  }

  const lockHolderId = `parallel-${Date.now()}`;
  const results = await runAllProviders(
    input.providers,
    input.prompt,
    input.timeout_ms,
    lockHolderId,
  );

  return mergeParallelResults(input.mergeStrategy, results);
}

export interface ParallelJobMetadata {
  mergeStrategy: MergeStrategy;
  providers: ParallelProviderSpec[];
  routeCategory?: string;
  autoRouted?: boolean;
  childJobIds?: string[];
  providerResults?: ParallelProviderResult[];
  winnerProvider?: string;
  consensusScore?: number;
}

/** Cria job pai + filhos e retorna IDs. */
export async function createParallelJob(
  workspace: string,
  input: ParallelDelegateInput,
  extraMetadata: Partial<ParallelJobMetadata> = {},
): Promise<{ parentJobId: string; childJobIds: string[] }> {
  const parent = await createJob({
    workspace,
    provider: "parallel",
    prompt: input.prompt,
    mode: "parallel",
    timeoutMs: input.timeout_ms,
    metadata: {
      mergeStrategy: input.mergeStrategy,
      providers: input.providers,
      ...extraMetadata,
    },
  });

  const childJobIds: string[] = [];
  for (const spec of input.providers) {
    const child = await createJob({
      workspace,
      provider: spec.provider,
      prompt: input.prompt,
      model: spec.model,
      mode: spec.mode ?? "subagent",
      agenticMode: spec.agentic_mode ?? false,
      timeoutMs: input.timeout_ms,
      parentJobId: parent.id,
      metadata: { parallelChild: true },
    });
    childJobIds.push(child.id);
  }

  await updateJob(parent.id, {
    metadata: {
      mergeStrategy: input.mergeStrategy,
      providers: input.providers,
      childJobIds,
      ...extraMetadata,
    },
  });

  return { parentJobId: parent.id, childJobIds };
}

/** Executa job paralelo: roda filhos e faz merge no pai. */
export async function executeParallelJob(parentJobId: string): Promise<ParallelMergeResult> {
  const parent = await getJob(parentJobId);
  if (!parent) {
    throw new Error(`Job paralelo ${parentJobId} não encontrado`);
  }

  const metadata = parent.metadata as unknown as ParallelJobMetadata;
  const mergeStrategy = metadata.mergeStrategy ?? "raw_all";
  const providers = metadata.providers ?? [];
  const childJobIds = metadata.childJobIds ?? [];

  await appendJobEvent(parentJobId, "parallel_start", {
    providers: providers.map((p) => p.provider),
    mergeStrategy,
    childCount: childJobIds.length,
  });

  const input: ParallelDelegateInput = {
    prompt: parent.prompt,
    providers,
    mergeStrategy,
    timeout_ms: parent.timeout_ms,
  };

  const result = await runParallelDelegation(input);

  await updateJob(parentJobId, {
    metadata: {
      ...metadata,
      providerResults: result.providerResults,
      winnerProvider: result.winnerProvider,
      consensusScore: result.consensusScore,
    },
  });

  await appendJobEvent(parentJobId, "parallel_merge", {
    strategy: mergeStrategy,
    successCount: result.successCount,
    failureCount: result.failureCount,
    winnerProvider: result.winnerProvider,
  });

  return result;
}
