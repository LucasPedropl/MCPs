import { createJobChunkEmitter } from "../observability/chunk-emitter.js";
import {
  appendJobEvent,
  createJob,
  getJob,
  listChildJobs,
  updateJob,
} from "../jobs/job-store.js";
import { pickAntigravityModel, type AntigravityTaskCategory } from "../../providers/antigravity/model-router.js";
import { runDelegationWithFallback } from "../../providers/fallback.js";
import { buildJobMetrics, recordJobMetrics } from "../jobs/job-metrics.js";
import { isAgenticRole, isHitlEnabled, pauseForApproval } from "../jobs/job-hitl.js";
import { buildStepPrompt, updateContextForRole } from "./templates.js";
import { compressPipelineContext, compressStepOutput } from "./context-compress.js";
import {
  MAX_REVIEW_FIX_LOOPS,
  reviewNeedsFix,
  validateStepOutput,
} from "./validators.js";
import type {
  PipelineJobMetadata,
  PipelineRunInput,
  PipelineRunResult,
  PipelineStepConfig,
  PipelineStepResult,
  PromptContext,
} from "./types.js";

function roleToModelCategory(role: PipelineStepConfig["role"]): AntigravityTaskCategory {
  if (role === "plan") return "architecture";
  if (role === "review") return "review";
  if (role === "fix") return "implement";
  return "implement";
}

/** Cria job pai pipeline + metadados dos steps. */
export async function createPipelineJob(
  workspace: string,
  input: PipelineRunInput,
): Promise<string> {
  const parent = await createJob({
    workspace,
    provider: "pipeline",
    prompt: input.task,
    mode: "pipeline",
    timeoutMs: input.timeout_ms * input.steps.length,
    metadata: {
      task: input.task,
      steps: input.steps,
    } satisfies PipelineJobMetadata,
  });

  await appendJobEvent(parent.id, "pipeline_created", {
    stepCount: input.steps.length,
    roles: input.steps.map((s) => s.role),
  });

  return parent.id;
}

async function runPipelineStep(
  pipelineJobId: string,
  workspace: string,
  step: PipelineStepConfig,
  prompt: string,
  timeout_ms: number,
  stepIndex: number,
  loopIteration?: number,
): Promise<PipelineStepResult> {
  const started = Date.now();
  const resolvedModel =
    step.model ??
    (step.provider === "antigravity" ? pickAntigravityModel(roleToModelCategory(step.role)) : undefined);
  const stepJob = await createJob({
    workspace,
    provider: step.provider,
    prompt,
    model: resolvedModel,
    agenticMode: step.agentic_mode ?? false,
    timeoutMs: timeout_ms,
    parentJobId: pipelineJobId,
    metadata: { pipelineRole: step.role, stepIndex, loopIteration },
  });

  const onChunk = createJobChunkEmitter(stepJob.id);

  try {
    const result = await runDelegationWithFallback({
      provider: step.provider,
      prompt,
      model: resolvedModel,
      mode: "subagent",
      agentic_mode: step.agentic_mode ?? false,
      timeout_ms,
      on_chunk: onChunk,
    });

    if (!result.success) {
      await updateJob(stepJob.id, {
        status: "failed",
        error: result.message,
        completed_at: new Date().toISOString(),
      });
      return {
        role: step.role,
        provider: step.provider,
        status: "failed",
        output: "",
        stepJobId: stepJob.id,
        durationMs: Date.now() - started,
        error: result.message,
        loopIteration,
      };
    }

    const validation = validateStepOutput(step.role, result.response);
    if (!validation.valid) {
      const validationMsg = validation.errors?.join("; ") ?? "Validação falhou";
      await updateJob(stepJob.id, {
        status: "failed",
        error: validationMsg,
        response: result.response,
        completed_at: new Date().toISOString(),
      });
      return {
        role: step.role,
        provider: step.provider,
        status: "failed",
        output: result.response,
        stepJobId: stepJob.id,
        durationMs: Date.now() - started,
        error: validationMsg,
        validationErrors: validation.errors,
        loopIteration,
      };
    }

    await updateJob(stepJob.id, {
      status: "completed",
      response: result.response,
      session_id: result.sessionId,
      cascade_id: result.cascadeId,
      model: result.model,
      completed_at: new Date().toISOString(),
    });

    void recordJobMetrics(
      stepJob.id,
      buildJobMetrics({
        provider: step.provider,
        prompt,
        response: result.response,
        durationMs: Date.now() - started,
      }),
    ).catch((err: unknown) => {
      console.error("[pipeline] métricas falharam:", err instanceof Error ? err.message : String(err));
    });

    return {
      role: step.role,
      provider: step.provider,
      status: "success",
      output: result.response,
      stepJobId: stepJob.id,
      durationMs: Date.now() - started,
      loopIteration,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(stepJob.id, {
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
    });
    return {
      role: step.role,
      provider: step.provider,
      status: "failed",
      output: "",
      stepJobId: stepJob.id,
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

/** Executa pipeline sequencial plan→implement→review→fix. */
export async function executePipelineJob(
  pipelineJobId: string,
  startFromIndex?: number,
  initialContext?: PromptContext,
): Promise<PipelineRunResult> {
  const parent = await getJob(pipelineJobId);
  if (!parent) {
    throw new Error(`Pipeline ${pipelineJobId} não encontrado`);
  }

  const metadata = parent.metadata as unknown as PipelineJobMetadata;
  const steps = metadata.steps ?? [];
  const task = metadata.task ?? parent.prompt;
  const timeout_ms = Math.max(60_000, Math.floor(parent.timeout_ms / Math.max(steps.length, 1)));

  let ctx = initialContext ?? { task };
  const startIndex = startFromIndex ?? 0;

  const stepResults: PipelineStepResult[] =
    startIndex > 0 && metadata.stepResults ? metadata.stepResults.slice(0, startIndex) : [];

  if (startIndex === 0) {
    await appendJobEvent(pipelineJobId, "pipeline_start", { stepCount: steps.length });
  }

  for (let index = startIndex; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step) {
      continue;
    }
    const prompt = buildStepPrompt(step.role, ctx);

    if (
      isHitlEnabled() &&
      isAgenticRole(step.role) &&
      (step.agentic_mode ?? false) &&
      !metadata.resumeAfterApproval
    ) {
      await pauseForApproval(
        pipelineJobId,
        {
          stepIndex: index,
          role: step.role,
          prompt,
          requestedAt: new Date().toISOString(),
        },
        {
          ...metadata,
          stepResults,
          currentStepIndex: index > 0 ? index - 1 : undefined,
          pipelineContext: ctx,
        },
      );
      return {
        pipelineJobId,
        status: "awaiting_approval",
        stepResults,
        finalOutput: "",
      };
    }

    await appendJobEvent(pipelineJobId, "pipeline_step_start", {
      role: step.role,
      provider: step.provider,
      stepIndex: index,
    });

    const result = await runPipelineStep(
      pipelineJobId,
      parent.workspace,
      step,
      prompt,
      timeout_ms,
      index,
    );

    stepResults.push(result);
    await appendJobEvent(pipelineJobId, "pipeline_step", {
      role: step.role,
      status: result.status,
      stepJobId: result.stepJobId,
      durationMs: result.durationMs,
    });

    if (result.status === "failed") {
      await updateJob(pipelineJobId, {
        metadata: { ...metadata, stepResults, failedAt: step.role },
        status: "failed",
        error: result.error ?? `Step ${step.role} falhou`,
        completed_at: new Date().toISOString(),
      });

      return {
        pipelineJobId,
        status: "failed",
        stepResults,
        finalOutput: result.error ?? "",
        failedAt: step.role,
      };
    }

    ctx = updateContextForRole(
      step.role,
      compressStepOutput(step.role, result.output),
      ctx,
    );
    ctx = compressPipelineContext(ctx);

    const clearedMetadata = metadata.resumeAfterApproval
      ? { ...metadata, resumeAfterApproval: false, approvedStepIndex: undefined }
      : metadata;

    await updateJob(pipelineJobId, {
      metadata: {
        ...clearedMetadata,
        stepResults,
        currentStepIndex: index,
        pipelineContext: ctx,
      },
    });
  }

  const reviewStep = steps.find((s) => s.role === "review");
  const fixStep = steps.find((s) => s.role === "fix");
  let reviewFixLoops = metadata.reviewFixLoops ?? 0;

  while (
    reviewFixLoops < MAX_REVIEW_FIX_LOOPS &&
    reviewStep &&
    fixStep
  ) {
    const lastReview = [...stepResults].reverse().find((r) => r.role === "review" && r.status === "success");
    if (!lastReview) {
      break;
    }

    const reviewValidation = validateStepOutput("review", lastReview.output);
    if (!reviewNeedsFix(reviewValidation)) {
      break;
    }

    reviewFixLoops += 1;
    await appendJobEvent(pipelineJobId, "pipeline_review_fix_loop", {
      loop: reviewFixLoops,
      maxLoops: MAX_REVIEW_FIX_LOOPS,
    });

    const fixPrompt = buildStepPrompt("fix", ctx);
    const fixResult = await runPipelineStep(
      pipelineJobId,
      parent.workspace,
      fixStep,
      fixPrompt,
      timeout_ms,
      steps.length + reviewFixLoops,
      reviewFixLoops,
    );
    stepResults.push(fixResult);

    if (fixResult.status === "failed") {
      await updateJob(pipelineJobId, {
        metadata: { ...metadata, stepResults, reviewFixLoops, failedAt: "fix" },
        status: "failed",
        error: fixResult.error ?? "Fix loop falhou",
        completed_at: new Date().toISOString(),
      });
      return {
        pipelineJobId,
        status: "failed",
        stepResults,
        finalOutput: fixResult.error ?? "",
        failedAt: "fix",
      };
    }

    ctx = updateContextForRole("fix", fixResult.output, ctx);

    const verifyPrompt = buildStepPrompt("review", ctx);
    const verifyResult = await runPipelineStep(
      pipelineJobId,
      parent.workspace,
      reviewStep,
      verifyPrompt,
      timeout_ms,
      steps.length + reviewFixLoops * 2,
      reviewFixLoops,
    );
    stepResults.push(verifyResult);
    ctx = updateContextForRole("review", verifyResult.output, ctx);

    if (verifyResult.status === "failed") {
      await updateJob(pipelineJobId, {
        metadata: { ...metadata, stepResults, reviewFixLoops, failedAt: "review" },
        status: "failed",
        error: verifyResult.error ?? "Review de verificação falhou",
        completed_at: new Date().toISOString(),
      });
      return {
        pipelineJobId,
        status: "failed",
        stepResults,
        finalOutput: verifyResult.error ?? "",
        failedAt: "review",
      };
    }

    await updateJob(pipelineJobId, {
      metadata: {
        ...metadata,
        stepResults,
        reviewFixLoops,
        pipelineContext: ctx,
      },
    });
  }

  const finalOutput = stepResults.at(-1)?.output ?? "";
  await updateJob(pipelineJobId, {
    status: "completed",
    response: finalOutput,
    metadata: { ...metadata, stepResults, reviewFixLoops },
    completed_at: new Date().toISOString(),
  });

  await appendJobEvent(pipelineJobId, "pipeline_complete", {
    stepCount: stepResults.length,
    responseLength: finalOutput.length,
  });

  return {
    pipelineJobId,
    status: "completed",
    stepResults,
    finalOutput,
  };
}

export async function getPipelineSnapshot(pipelineJobId: string) {
  const job = await getJob(pipelineJobId);
  if (!job) return null;
  const children = await listChildJobs(pipelineJobId);
  const metadata = job.metadata as unknown as PipelineJobMetadata;
  return { job, children, stepResults: metadata.stepResults ?? [] };
}

export async function resumePipelineJob(pipelineJobId: string): Promise<PipelineRunResult> {
  const job = await getJob(pipelineJobId);
  if (!job) {
    throw new Error(`Pipeline ${pipelineJobId} não encontrado`);
  }

  if (
    job.status !== "failed" &&
    job.status !== "cancelled" &&
    job.status !== "pending"
  ) {
    throw new Error(`Pipeline não pode ser resumido a partir do status: ${job.status}`);
  }

  const metadata = job.metadata as unknown as PipelineJobMetadata;
  if (job.status === "pending" && !metadata.resumeRequested && metadata.currentStepIndex === undefined) {
    throw new Error("Pipeline pending sem checkpoint para resume");
  }
  const lastCompletedIndex = metadata.currentStepIndex ?? -1;
  const nextIndex = lastCompletedIndex + 1;
  const ctx = metadata.pipelineContext;

  await updateJob(pipelineJobId, { status: "running" });
  await appendJobEvent(pipelineJobId, "pipeline_resumed", { startFromIndex: nextIndex });

  return executePipelineJob(pipelineJobId, nextIndex, ctx);
}
