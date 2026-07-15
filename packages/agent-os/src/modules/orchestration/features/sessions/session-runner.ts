import {
  DEFAULT_ANTIGRAVITY_MODEL,
  type ModelEnum,
  type SendUserCascadeMessageResponse,
} from "../../client/types.js";
import { getClient, runDelegation } from "../../tools/delegation.js";
import { pollForResponse } from "../../utils/polling.js";
import {
  APPROVE_PLAN_PROMPT,
  AWAITING_PLAN_HINT,
  REJECT_PLAN_PROMPT,
} from "../../utils/plan-approval.js";
import { buildContextPackPrompt } from "./context-pack.js";
import { prepareAntigravityPrompt } from "../../features/delegation/delegation-lang.js";
import {
  resolveAntigravityPlannerMode,
  type PlannerModeParam,
} from "../../providers/antigravity/config.js";
import {
  getSession,
  listSharedContext,
  updateSession,
} from "./session-store.js";
import type { DelegationSessionRow } from "./types.js";

export interface ContinueSessionInput {
  sessionId: string;
  prompt?: string;
  model?: string;
  agentic_mode?: boolean;
  planner_mode?: PlannerModeParam;
  timeout_ms?: number;
  include_context_pack?: boolean;
  approve_plan?: boolean;
  reject_plan?: boolean;
}

export interface ContinueSessionResult {
  session: DelegationSessionRow;
  response: string;
  externalSessionId?: string;
  model?: string;
  resumedNative: boolean;
  awaiting_plan_approval?: boolean;
  hint?: string;
  plan_action?: "approved" | "rejected";
}

async function continueAntigravityCascade(
  cascadeId: string,
  prompt: string,
  model: string,
  agenticMode: boolean,
  timeoutMs: number,
  plannerModeParam?: PlannerModeParam,
): Promise<{
  response: string;
  model?: string;
  messageId?: string;
  awaitingPlanApproval?: boolean;
}> {
  const plannerMode = resolveAntigravityPlannerMode(plannerModeParam);
  const client = await getClient();
  await client.call<SendUserCascadeMessageResponse>("SendUserCascadeMessage", {
    cascadeId,
    items: [{ text: prompt }],
    cascadeConfig: {
      plannerConfig: {
        planModel: model as ModelEnum,
        conversational: { agenticMode, plannerMode },
        requestedModel: { model: model as ModelEnum },
      },
    },
    clientType: "SDK_EXECUTABLE",
  });

  const result = await pollForResponse(client, cascadeId, {
    timeoutMs,
    agenticMode,
  });
  return {
    response: result.response,
    model: result.model ?? model,
    messageId: result.messageId,
    awaitingPlanApproval: result.awaitingPlanApproval,
  };
}

function resolveContinuePrompt(input: ContinueSessionInput): {
  prompt: string;
  planAction?: "approved" | "rejected";
  agenticMode: boolean;
  plannerMode: PlannerModeParam;
} {
  if (input.approve_plan && input.reject_plan) {
    throw new Error("Não use approve_plan e reject_plan ao mesmo tempo");
  }

  if (input.approve_plan) {
    return {
      prompt: input.prompt?.trim() || APPROVE_PLAN_PROMPT,
      planAction: "approved",
      agenticMode: input.agentic_mode ?? true,
      plannerMode: input.planner_mode ?? "off",
    };
  }

  if (input.reject_plan) {
    return {
      prompt: input.prompt?.trim() || REJECT_PLAN_PROMPT,
      planAction: "rejected",
      agenticMode: false,
      plannerMode: input.planner_mode ?? "off",
    };
  }

  const prompt = input.prompt?.trim();
  if (!prompt) {
    throw new Error("continue_session exige prompt (ou approve_plan/reject_plan)");
  }

  return {
    prompt,
    agenticMode: input.agentic_mode ?? false,
    plannerMode: input.planner_mode ?? "off",
  };
}

/** Continua uma sessão existente com context pack ou resume nativo (Antigravity). */
export async function continueSession(
  input: ContinueSessionInput,
): Promise<ContinueSessionResult> {
  const session = await getSession(input.sessionId);
  if (!session) {
    throw new Error(`Sessão ${input.sessionId} não encontrada`);
  }

  const resolved = resolveContinuePrompt(input);
  const skipContextPack =
    Boolean(resolved.planAction) || input.include_context_pack === false;

  const contextItems = skipContextPack
    ? []
    : await listSharedContext(session.workspace, session.id, 10);

  const enrichedPrompt = buildContextPackPrompt(
    session,
    resolved.prompt,
    contextItems,
  );
  const model = input.model ?? session.model ?? undefined;
  const timeoutMs = input.timeout_ms ?? 120_000;
  const agenticMode = resolved.agenticMode;

  let response: string;
  let externalSessionId: string | undefined;
  let resultModel: string | undefined;
  let resumedNative = false;
  let awaitingPlanApproval: boolean | undefined;

  if (
    session.provider === "antigravity" &&
    session.external_session_id &&
    contextItems.length === 0
  ) {
    const native = await continueAntigravityCascade(
      session.external_session_id,
      prepareAntigravityPrompt(resolved.prompt),
      model ?? DEFAULT_ANTIGRAVITY_MODEL,
      agenticMode,
      timeoutMs,
      resolved.plannerMode,
    );
    response = native.response;
    externalSessionId = session.external_session_id;
    resultModel = native.model;
    resumedNative = true;
    awaitingPlanApproval = native.awaitingPlanApproval;
  } else {
    const result = await runDelegation({
      provider: session.provider,
      prompt: enrichedPrompt,
      model,
      mode: "subagent",
      agentic_mode: agenticMode,
      planner_mode: resolved.plannerMode,
      timeout_ms: timeoutMs,
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    response = result.response;
    externalSessionId = result.sessionId ?? result.cascadeId;
    resultModel = result.model;
    awaitingPlanApproval = result.awaiting_plan_approval;
  }

  const updated = await updateSession(session.id, {
    last_prompt: resolved.prompt,
    last_response: response,
    ...(externalSessionId ? { external_session_id: externalSessionId } : {}),
    ...(resultModel ? { model: resultModel } : {}),
  });

  return {
    session: updated,
    response,
    externalSessionId,
    model: resultModel,
    resumedNative,
    awaiting_plan_approval: awaitingPlanApproval,
    hint: awaitingPlanApproval ? AWAITING_PLAN_HINT : undefined,
    plan_action: resolved.planAction,
  };
}
