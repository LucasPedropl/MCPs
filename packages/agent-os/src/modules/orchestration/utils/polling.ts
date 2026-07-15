import type { CascadeStep } from "../client/types.js";
import type { AntigravityClient } from "../client/antigravity-client.js";
import type { GetCascadeTrajectoryStepsResponse, PollOptions } from "../client/types.js";
import { isAwaitingPlanApproval } from "./plan-approval.js";

const DEFAULT_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_INTERVAL_MS = 2_000;
const BACKOFF_FACTOR = 1.5;
const STABLE_POLLS_REQUIRED = 3;

const IN_FLIGHT_STEP_PATTERN =
  /CORTEX_STEP_TYPE_(TOOL|ACTION|EXEC|EDIT|COMMAND|TERMINAL|RUN|SHELL|APPLY)/i;

export interface PollResult {
  response: string;
  model?: string;
  messageId?: string;
  steps: CascadeStep[];
  awaitingPlanApproval?: boolean;
}

export async function pollForResponse(
  client: AntigravityClient,
  cascadeId: string,
  options: PollOptions = {},
): Promise<PollResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const agenticMode = options.agenticMode ?? false;
  const startTime = Date.now();
  let intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let lastProgressLength = 0;
  let lastResponse = "";
  let lastStepCount = 0;
  let stableTextPolls = 0;
  let stableStepPolls = 0;

  while (Date.now() - startTime < timeoutMs) {
    const result = await client.call<GetCascadeTrajectoryStepsResponse>(
      "GetCascadeTrajectorySteps",
      { cascadeId },
    );

    const steps = result.steps ?? [];
    const stepCount = steps.length;

    if (stepCount > lastStepCount) {
      lastStepCount = stepCount;
      stableStepPolls = 0;
      stableTextPolls = 0;
    } else if (agenticMode && stepCount > 0) {
      stableStepPolls += 1;
    }

    const plannerStep = steps.length ? findPlannerResponse(steps) : undefined;
    const responseText = plannerStep?.plannerResponse?.response ?? "";

    if (responseText.length > lastProgressLength && options.onProgress) {
      lastProgressLength = responseText.length;
      await options.onProgress({ response: responseText, stepCount });
    }

    const agenticBusy = agenticMode && hasInFlightAgenticWork(steps);

    if (responseText && !agenticBusy) {
      if (responseText === lastResponse) {
        stableTextPolls += 1;
      } else {
        lastResponse = responseText;
        stableTextPolls = 0;
      }

      const stepsReady = !agenticMode || stableStepPolls >= STABLE_POLLS_REQUIRED;
      if (stableTextPolls >= STABLE_POLLS_REQUIRED && stepsReady) {
        return {
          response: responseText,
          model: plannerStep?.metadata?.generatorModel,
          messageId: plannerStep?.plannerResponse?.messageId,
          steps,
          awaitingPlanApproval: isAwaitingPlanApproval(responseText),
        };
      }
    }

    await sleep(intervalMs);
    intervalMs = Math.min(intervalMs * BACKOFF_FACTOR, MAX_INTERVAL_MS);
  }

  throw new Error(`Polling timeout after ${timeoutMs}ms waiting for cascade ${cascadeId}`);
}

function hasInFlightAgenticWork(steps: CascadeStep[]): boolean {
  const recent = steps.slice(-8);
  for (const step of recent) {
    const type = String(step.type ?? "");
    if (IN_FLIGHT_STEP_PATTERN.test(type)) {
      return true;
    }
    if (type.includes("TOOL") && !type.includes("RESULT") && !type.includes("RESPONSE")) {
      return true;
    }
    if (step["status"] === "in_progress" || step["status"] === "running") {
      return true;
    }
  }
  return false;
}

function findPlannerResponse(steps: CascadeStep[]): CascadeStep | undefined {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (
      step?.type === "CORTEX_STEP_TYPE_PLANNER_RESPONSE" &&
      step.plannerResponse?.response
    ) {
      return step;
    }
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
