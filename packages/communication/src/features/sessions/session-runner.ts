import {
  DEFAULT_ANTIGRAVITY_MODEL,
  type ModelEnum,
  type SendUserCascadeMessageResponse,
} from "../../client/types.js";
import { getClient, runDelegation } from "../../tools/delegation.js";
import { pollForResponse } from "../../utils/polling.js";
import { buildContextPackPrompt } from "./context-pack.js";
import { prepareAntigravityPrompt } from "../../features/delegation/delegation-lang.js";
import {
  getSession,
  listSharedContext,
  updateSession,
} from "./session-store.js";
import type { DelegationSessionRow } from "./types.js";

export interface ContinueSessionInput {
  sessionId: string;
  prompt: string;
  model?: string;
  agentic_mode?: boolean;
  timeout_ms?: number;
  include_context_pack?: boolean;
}

export interface ContinueSessionResult {
  session: DelegationSessionRow;
  response: string;
  externalSessionId?: string;
  model?: string;
  resumedNative: boolean;
}

async function continueAntigravityCascade(
  cascadeId: string,
  prompt: string,
  model: string,
  agenticMode: boolean,
  timeoutMs: number,
): Promise<{ response: string; model?: string; messageId?: string }> {
  const client = await getClient();
  await client.call<SendUserCascadeMessageResponse>("SendUserCascadeMessage", {
    cascadeId,
    items: [{ text: prompt }],
    cascadeConfig: {
      plannerConfig: {
        planModel: model as ModelEnum,
        conversational: { agenticMode },
        requestedModel: { model: model as ModelEnum },
      },
    },
    clientType: "SDK_EXECUTABLE",
  });

  const result = await pollForResponse(client, cascadeId, { timeoutMs });
  return { response: result.response, model: result.model ?? model, messageId: result.messageId };
}

/** Continua uma sessão existente com context pack ou resume nativo (Antigravity). */
export async function continueSession(
  input: ContinueSessionInput,
): Promise<ContinueSessionResult> {
  const session = await getSession(input.sessionId);
  if (!session) {
    throw new Error(`Sessão ${input.sessionId} não encontrada`);
  }

  const contextItems = input.include_context_pack !== false
    ? await listSharedContext(session.workspace, session.id, 10)
    : [];

  const enrichedPrompt = buildContextPackPrompt(session, input.prompt, contextItems);
  const model = input.model ?? session.model ?? undefined;
  const timeoutMs = input.timeout_ms ?? 120_000;
  const agenticMode = input.agentic_mode ?? false;

  let response: string;
  let externalSessionId: string | undefined;
  let resultModel: string | undefined;
  let resumedNative = false;

  if (
    session.provider === "antigravity" &&
    session.external_session_id &&
    contextItems.length === 0
  ) {
    const native = await continueAntigravityCascade(
      session.external_session_id,
      prepareAntigravityPrompt(input.prompt),
      model ?? DEFAULT_ANTIGRAVITY_MODEL,
      agenticMode,
      timeoutMs,
    );
    response = native.response;
    externalSessionId = session.external_session_id;
    resultModel = native.model;
    resumedNative = true;
  } else {
    const result = await runDelegation({
      provider: session.provider,
      prompt: enrichedPrompt,
      model,
      mode: "subagent",
      agentic_mode: agenticMode,
      timeout_ms: timeoutMs,
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    response = result.response;
    externalSessionId = result.sessionId ?? result.cascadeId;
    resultModel = result.model;
  }

  const updated = await updateSession(session.id, {
    last_prompt: input.prompt,
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
  };
}
