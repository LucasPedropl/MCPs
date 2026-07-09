import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveInstance } from "../client/discovery.js";
import { getWorkspaceResolutionDebug } from "../client/workspace.js";
import {
  checkAntigravityWorkspaceMatch,
  resolveWorkspacePath,
} from "../client/workspace-resolve.js";
import { formatAntigravityQuotas } from "../features/observability/quota-format.js";
import { isHitlEnabled } from "../features/jobs/job-hitl.js";
import { isRealtimeWorkerRunning } from "../features/jobs/realtime-worker.js";
import {
  isSupabaseConfigured,
  probeSupabaseConnection,
} from "../features/jobs/supabase-client.js";
import { getAntigravityHealth } from "../providers/antigravity/service.js";
import { getAllProviderStatusesWithAuth } from "../providers/status.js";
import { BRIDGE_FEATURES, BRIDGE_VERSION } from "./bridge.js";
import { describeTool, WORKSPACE_PATH_DESC } from "./tool-docs.js";
import { getClient } from "./delegation.js";

export interface UsageGuideResponse {
  bridgeVersion: string;
  recommendedFlow: string[];
  decisionTree: Record<string, string>;
  providersStatus: Array<{ provider: string; available: boolean; detail?: string }>;
  featuresEnabled: Record<string, unknown>;
  workspaceInfo: Record<string, unknown>;
  quotaSummary: ReturnType<typeof formatAntigravityQuotas>;
  warnings: string[];
  envHints: Record<string, string>;
  hitlEnabled: boolean;
  realtimeWorkerRunning: boolean;
}

/** Constrói guia dinâmico baseado no estado real do bridge. */
export async function buildUsageGuide(workspaceOverride?: string): Promise<UsageGuideResponse> {
  const warnings: string[] = [];
  let targetPath: string;

  try {
    targetPath = resolveWorkspacePath(workspaceOverride);
  } catch (error) {
    targetPath = "unknown";
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  const providers = await getAllProviderStatusesWithAuth();
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseReachable = supabaseConfigured ? await probeSupabaseConnection() : false;

  if (!supabaseConfigured) {
    warnings.push("Supabase não configurado — delegate_async, run_pipeline e sessions indisponíveis.");
  } else if (!supabaseReachable) {
    warnings.push("Supabase configurado mas inacessível — jobs async ficarão presos.");
  }

  const cursorDown = providers.find((p) => p.provider === "cursor" && !p.available);
  if (cursorDown) {
    warnings.push("Cursor CLI indisponível — pipeline step 'implement' usará fallback.");
  }

  let quotaSummary = formatAntigravityQuotas([]);
  try {
    const health = await getAntigravityHealth(await getClient());
    const user = health.user as {
      userStatus?: {
        cascadeModelConfigData?: {
          clientModelConfigs?: Array<{
            label?: string;
            modelOrAlias?: { model?: string };
            quotaInfo?: { remainingFraction?: number; resetTime?: string };
          }>;
        };
      };
    };
    const configs = user.userStatus?.cascadeModelConfigData?.clientModelConfigs ?? [];
    quotaSummary = formatAntigravityQuotas(configs);

    for (const pool of quotaSummary.pools) {
      if (pool.usedPercent > 70) {
        warnings.push(`Pool ${pool.name}: ${pool.usedPercent}% usado — economize tokens neste pool.`);
      }
    }
  } catch {
    warnings.push("Não foi possível ler quotas Antigravity — IDE fechado ou offline?");
  }

  try {
    const instance = await resolveInstance();
    const match = checkAntigravityWorkspaceMatch(targetPath, instance.workspacePath);
    if (!match.matched && match.warning) {
      warnings.push(match.warning);
    }
  } catch {
    warnings.push("Antigravity não detectado — delegações antigravity podem falhar ou auto-launch.");
  }

  return {
    bridgeVersion: BRIDGE_VERSION,
    recommendedFlow: [
      "1. get_usage_guide — entender contexto e warnings",
      "2. bridge_status — confirmar targetWorkspace e quotaPools",
      "3. list_models(provider) — se precisar escolher modelo",
      "4. delegate_and_wait(agentic_mode=false) — smoke test",
      "5. delegate_async ou run_pipeline — trabalho real",
      "6. get_job_status — acompanhar até isTerminal",
    ],
    decisionTree: {
      quick_answer: "delegate_and_wait (agentic_mode=false)",
      full_metadata: "delegate_task",
      long_background: "delegate_async + get_job_status",
      multi_step_feature: "run_pipeline",
      compare_providers: "delegate_parallel",
      multi_turn: "create_session → continue_session",
      cancel: "cancel_job",
      debug_failed: "job_admin (action=dlq)",
    },
    providersStatus: providers.map((p) => ({
      provider: p.provider,
      available: p.available,
      detail: p.detail,
    })),
    featuresEnabled: { ...BRIDGE_FEATURES },
    workspaceInfo: {
      targetPath,
      resolution: getWorkspaceResolutionDebug(),
      perProjectHint: 'Use "BRIDGE_DEFAULT_CWD": "${workspaceFolder}" in .cursor/mcp.json',
    },
    quotaSummary,
    warnings,
    hitlEnabled: isHitlEnabled(),
    realtimeWorkerRunning: isRealtimeWorkerRunning(),
    envHints: {
      BRIDGE_DEFAULT_CWD: "Fixa workspace por projeto no mcp.json",
      BRIDGE_SUPABASE_KEY: "Obrigatório para jobs async",
      BRIDGE_HITL_ENABLED: "1 = pausa steps agentic para aprovação humana",
      BRIDGE_REALTIME_WORKER: "1 = processa jobs via Supabase Realtime",
      BRIDGE_HOT_RELOAD: "1 = reinicia MCP ao salvar código",
      BRIDGE_ISOLATE_WORKSPACE: "0 = desliga worktree isolation",
      BRIDGE_DELEGATION_LANG: "en (default, token savings) | pt — idioma inter-agente Antigravity",
      BRIDGE_DELEGATION_LANG_ALL: "1 = aplica prefixo EN também em Cursor/Copilot",
    },
  };
}

export function registerUsageGuideTool(server: McpServer): void {
  server.tool(
    "get_usage_guide",
    describeTool("get_usage_guide"),
    {
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ workspace_path }) => {
      const guide = await buildUsageGuide(workspace_path);
      return {
        content: [{ type: "text", text: JSON.stringify(guide, null, 2) }],
      };
    },
  );
}
