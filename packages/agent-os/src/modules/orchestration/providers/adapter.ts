import type { BridgeProvider } from "../client/types.js";
import type { AntigravityClient } from "../client/antigravity-client.js";
import { delegateToAntigravity } from "./antigravity/service.js";
import { listAntigravityModels } from "./antigravity/service.js";
import { delegateToCursor } from "./cursor/service.js";
import { probeCursorModels } from "./cursor/model-probe.js";
import { delegateToCopilot } from "./copilot/service.js";
import { probeCopilotModels } from "./copilot/model-probe.js";
import type { DelegateParams, DelegationResult } from "../tools/delegation.js";

export interface ProviderHealth {
  available: boolean;
  detail: string;
}

export interface ProviderModelInfo {
  id: string;
  label: string;
  available?: boolean;
}

export interface IProviderAdapter {
  readonly provider: BridgeProvider;
  delegate(params: Omit<DelegateParams, "provider">): Promise<DelegationResult>;
  listModels(): Promise<ProviderModelInfo[]>;
  getHealth(): Promise<ProviderHealth>;
}

class AntigravityAdapter implements IProviderAdapter {
  readonly provider = "antigravity" as const;

  constructor(private client: AntigravityClient) {}

  async delegate(params: Omit<DelegateParams, "provider">): Promise<DelegationResult> {
    const result = await delegateToAntigravity(this.client, {
      prompt: params.prompt,
      model: params.model,
      mode: params.mode === "bridge" ? "bridge" : "subagent",
      agenticMode: params.agentic_mode,
      timeoutMs: params.timeout_ms,
      onProgress: params.on_chunk
        ? (p) => {
            void params.on_chunk?.(p.response);
          }
        : undefined,
    });
    return {
      success: true,
      provider: "antigravity",
      mode: result.modeUsed ?? "subagent",
      response: result.response,
      cascadeId: result.cascadeId,
      model: result.model,
      messageId: result.messageId,
    };
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    const raw = await listAntigravityModels(this.client);
    const configs = (raw as { clientModelConfigs?: Array<{ label?: string; modelOrAlias?: { model?: string } }> })
      .clientModelConfigs;
    if (configs?.length) {
      return configs.map((m) => ({
        id: m.modelOrAlias?.model ?? m.label ?? "",
        label: m.label ?? m.modelOrAlias?.model ?? "",
        available: true,
      }));
    }
    return [];
  }

  async getHealth(): Promise<ProviderHealth> {
    return { available: true, detail: "ConnectRPC ok" };
  }
}

class CursorAdapter implements IProviderAdapter {
  readonly provider = "cursor" as const;

  async delegate(params: Omit<DelegateParams, "provider">): Promise<DelegationResult> {
    const result = await delegateToCursor({
      prompt: params.prompt,
      model: params.model,
      timeoutMs: params.timeout_ms,
      onChunk: params.on_chunk,
    });
    return {
      success: true,
      provider: "cursor",
      mode: "subagent",
      response: result.response,
      sessionId: result.sessionId,
      model: result.model,
      exitCode: result.exitCode,
    };
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    return probeCursorModels();
  }

  async getHealth(): Promise<ProviderHealth> {
    const models = await probeCursorModels();
    return {
      available: models.some((m) => m.available),
      detail: models.some((m) => m.available) ? "CLI ok" : "CLI indisponível",
    };
  }
}

class CopilotAdapter implements IProviderAdapter {
  readonly provider = "copilot" as const;

  async delegate(params: Omit<DelegateParams, "provider">): Promise<DelegationResult> {
    const result = await delegateToCopilot({
      prompt: params.prompt,
      model: params.model,
      timeoutMs: params.timeout_ms,
      agenticMode: params.agentic_mode,
      readTools: params.read_tools,
      onChunk: params.on_chunk,
    });
    return {
      success: true,
      provider: "copilot",
      mode: "subagent",
      response: result.response,
      sessionId: result.sessionId,
      model: result.model,
      exitCode: result.exitCode,
    };
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    return probeCopilotModels();
  }

  async getHealth(): Promise<ProviderHealth> {
    const models = await probeCopilotModels();
    return {
      available: models.length > 0,
      detail: `${models.length} modelos conhecidos`,
    };
  }
}

export function createProviderAdapter(
  provider: BridgeProvider,
  antigravityClient?: AntigravityClient,
): IProviderAdapter {
  if (provider === "antigravity") {
    if (!antigravityClient) {
      throw new Error("AntigravityClient necessário para AntigravityAdapter");
    }
    return new AntigravityAdapter(antigravityClient);
  }
  if (provider === "cursor") {
    return new CursorAdapter();
  }
  if (provider === "copilot") {
    return new CopilotAdapter();
  }
  throw new Error(`Provider ${provider} não suportado pelo adapter`);
}
