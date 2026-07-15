import type { AntigravityClient } from "../../client/antigravity-client.js";
import {
  type CascadeConfig,
  type DelegationMode,
  type ModelEnum,
  type SendUserCascadeMessageResponse,
  type StartCascadeResponse,
} from "../../client/types.js";
import { pollForResponse } from "../../utils/polling.js";
import { AWAITING_PLAN_HINT } from "../../utils/plan-approval.js";
import { withCascadeSlot, getCascadePoolStats } from "./cascade-pool.js";
import {
  isAntigravityParallelEnabled,
  resolveAntigravityPlannerMode,
  type AntigravityPlannerMode,
  type PlannerModeParam,
} from "./config.js";
import { resolveAntigravityModel } from "./model-router.js";
import {
  delegateToHeadlessAntigravity,
  isHeadlessAntigravityEnabled,
  isHeadlessAvailable,
} from "./headless.js";

export interface DelegateToAntigravityInput {
  prompt: string;
  model?: string;
  agenticMode?: boolean;
  plannerMode?: PlannerModeParam;
  maxOutputTokens?: number;
  timeoutMs?: number;
  workspacePath?: string;
  mode?: DelegationMode;
  onProgress?: (partial: { response: string; stepCount: number }) => void | Promise<void>;
}

export interface DelegateToAntigravityResult {
  cascadeId?: string;
  response: string;
  model?: string;
  messageId?: string;
  usedHeadless?: boolean;
  isolatedBranch?: string;
  modeUsed?: "subagent" | "bridge" | "headless";
  awaitingPlanApproval?: boolean;
  hint?: string;
}

function buildCascadeConfig(
  model: ModelEnum,
  agenticMode: boolean,
  maxOutputTokens: number,
  plannerMode: AntigravityPlannerMode,
): CascadeConfig {
  return {
    plannerConfig: {
      planModel: model,
      conversational: { agenticMode, plannerMode },
      maxOutputTokens,
      requestedModel: { model },
    },
    checkpointConfig: { maxOutputTokens },
    applyModelDefaultOverride: false,
  };
}

async function runCascadeDelegation(
  client: AntigravityClient,
  input: DelegateToAntigravityInput,
  mode: "subagent" | "bridge",
): Promise<DelegateToAntigravityResult> {
  return withCascadeSlot(async () => {
  const routeResult = resolveAntigravityModel(
    input.prompt,
    input.agenticMode ?? false,
    input.model,
  );
  const model = routeResult.model;
  const agenticMode = input.agenticMode ?? false;
  const plannerMode = resolveAntigravityPlannerMode(input.plannerMode);
  const maxOutputTokens = input.maxOutputTokens ?? 8192;
  const timeoutMs = input.timeoutMs ?? 120_000;
  const showInChat = mode === "bridge";

  const startPayload: Record<string, unknown> = { source: 1 };
  if (showInChat) {
    startPayload.baseTrajectoryIdentifier = { lastActiveDoc: true };
  }

  const { cascadeId } = await client.call<StartCascadeResponse>("StartCascade", startPayload);

  await client.call<SendUserCascadeMessageResponse>("SendUserCascadeMessage", {
    cascadeId,
    items: [{ text: input.prompt }],
    cascadeConfig: buildCascadeConfig(model, agenticMode, maxOutputTokens, plannerMode),
    clientType: showInChat ? "IDE" : "SDK_EXECUTABLE",
  });

  const bridgeTimeout = showInChat ? Math.round(timeoutMs * 1.5) : timeoutMs;
  const result = await pollForResponse(client, cascadeId, {
    timeoutMs: bridgeTimeout,
    agenticMode,
    onProgress: input.onProgress,
  });

  const awaiting = Boolean(result.awaitingPlanApproval);
  return {
    cascadeId,
    response: result.response,
    model: result.model ?? model,
    messageId: result.messageId,
    modeUsed: mode,
    awaitingPlanApproval: awaiting || undefined,
    hint: awaiting ? AWAITING_PLAN_HINT : undefined,
  };
  });
}

export async function delegateToAntigravity(
  client: AntigravityClient,
  input: DelegateToAntigravityInput,
): Promise<DelegateToAntigravityResult> {
  const mode = input.mode ?? "subagent";
  const agentic = input.agenticMode ?? false;
  const isolatedPath = input.workspacePath;
  const wantsHeadless =
    isolatedPath &&
    isHeadlessAntigravityEnabled() &&
    isHeadlessAvailable() &&
    (agentic || isAntigravityParallelEnabled());

  if (wantsHeadless && isolatedPath) {
    const headless = await delegateToHeadlessAntigravity({
      prompt: input.prompt,
      workspacePath: isolatedPath,
      timeoutMs: input.timeoutMs,
    });
    return {
      response: headless.response,
      model: input.model,
      usedHeadless: true,
      modeUsed: "headless",
    };
  }

  if (agentic && isolatedPath && isAntigravityParallelEnabled() && !isHeadlessAvailable()) {
    throw new Error(
      "Paralelismo agentic requer agy headless (agy -p). Instale agy no PATH ou defina BRIDGE_ANTIGRAVITY_HEADLESS_CLI.",
    );
  }

  if (mode === "bridge") {
    try {
      return await runCascadeDelegation(client, input, "bridge");
    } catch {
      return runCascadeDelegation(client, input, "subagent");
    }
  }

  return runCascadeDelegation(client, input, "subagent");
}

export async function getAntigravityHealth(client: AntigravityClient): Promise<Record<string, unknown>> {
  const [status, userStatus] = await Promise.all([
    client.call<Record<string, unknown>>("Heartbeat"),
    client.call<Record<string, unknown>>("GetUserStatus").catch(() => ({})),
  ]);

  return {
    status: "ok",
    url: client.url,
    heartbeat: status,
    user: userStatus,
    headlessAvailable: isHeadlessAvailable(),
    headlessEnabled: isHeadlessAntigravityEnabled(),
    parallelEnabled: isAntigravityParallelEnabled(),
    plannerModeDefault: resolveAntigravityPlannerMode(),
    cascadePool: getCascadePoolStats(),
  };
}

export async function listAntigravityModels(
  client: AntigravityClient,
): Promise<Record<string, unknown>> {
  return client.call<Record<string, unknown>>("GetCascadeModelConfigData");
}
