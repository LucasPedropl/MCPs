import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getResolvedTargetWorkspace, resolveInstance } from "../client/discovery.js";
import { isAntigravityAutoLaunchEnabled } from "../client/launcher.js";
import { DEFAULT_ANTIGRAVITY_MODEL } from "../client/types.js";
import { getWorkspaceResolutionDebug } from "../client/workspace.js";
import {
  probeSupabaseConnection,
  getSupabaseStatus,
  isSupabaseConfigured,
} from "../features/jobs/supabase-client.js";
import {
  getAntigravityHealth,
  listAntigravityModels,
} from "../providers/antigravity/service.js";
import { getCascadePoolStats } from "../providers/antigravity/cascade-pool.js";
import { DEFAULT_CURSOR_MODEL } from "../providers/cursor/types.js";
import { recordAllProviderHealth } from "../features/observability/health-recorder.js";
import { getAllProviderStatusesWithAuth } from "../providers/status.js";
import { getTargetWorkspacePath } from "../client/workspace.js";
import { isAntigravityParallelEnabled } from "../providers/antigravity/config.js";
import { isAutoMergeEnabled } from "../features/workspace/git-merge.js";
import {
  getCircuitBreakerStats,
  isFallbackEnabled,
  runDelegationWithFallback,
} from "../providers/fallback.js";
import { isHitlEnabled } from "../features/jobs/job-hitl.js";
import { probeCursorModels } from "../providers/cursor/model-probe.js";
import { getDelegationLang, getDelegationLangHint } from "../features/delegation/delegation-lang.js";
import { pickAntigravityModel, inferTaskCategory } from "../providers/antigravity/model-router.js";
import { getClient } from "./delegation.js";
import { formatAntigravityQuotas } from "../features/observability/quota-format.js";
import { checkAntigravityWorkspaceMatch } from "../client/workspace-resolve.js";
import {
  describeTool,
  AGENTIC_MODE_DESC,
  MODE_DESC,
  WORKSPACE_PATH_DESC,
} from "./tool-docs.js";
import { guardDelegation } from "./policy-guard.js";

export const BRIDGE_VERSION = "1.0.1";
export const BRIDGE_FEATURES = {
  antigravity: true,
  cursor: true,
  hotReload: process.env["BRIDGE_HOT_RELOAD"] === "1",
  worktreeIsolation: process.env["BRIDGE_ISOLATE_WORKSPACE"] !== "0",
  autoMerge: isAutoMergeEnabled(),
  asyncJobs: true,
  parallel: true,
  parallelMerge: ["raw_all", "best_of", "consensus"],
  promptRouter: true,
  sessions: true,
  contextPack: true,
  streamingChunks: true,
  healthHistory: true,
  pipeline: true,
  pipelineZodValidation: true,
  pipelineReviewFixLoop: true,
  pipelineContextCompression: true,
  providerFallback: isFallbackEnabled(),
  circuitBreaker: true,
  jobMetrics: true,
  hitl: isHitlEnabled(),
  providerAdapter: true,
  antigravityModelRouter: true,
  dynamicModelListing: true,
  githubWebhooks: true,
  realtimeWorker: process.env["BRIDGE_REALTIME_WORKER"] === "1",
  antigravityParallel: isAntigravityParallelEnabled(),
  delegationLang: getDelegationLang(),
  delegationLangHint: getDelegationLangHint(),
  bridgeMode: "partial",
} as const;

export function registerBridgeTools(server: McpServer): void {
  server.tool(
    "bridge_status",
    describeTool("bridge_status"),
    {
      verbose: z
        .boolean()
        .optional()
        .describe("Se true, inclui payloads completos de debug (antigravityHealth raw)"),
    },
    async ({ verbose }) => {
      const providers = await getAllProviderStatusesWithAuth();
      const supabaseStatus = getSupabaseStatus();
      const supabaseReachable = isSupabaseConfigured()
        ? await probeSupabaseConnection()
        : false;

      let antigravitySummary: Record<string, unknown> | null = null;
      let selectedWorkspace: Record<string, unknown> | null = null;
      let antigravityHealth: Record<string, unknown> | null = null;

      let quotaPools: ReturnType<typeof formatAntigravityQuotas> | null = null;
      let workspaceMatch: ReturnType<typeof checkAntigravityWorkspaceMatch> | null = null;

      try {
        const instance = await resolveInstance();
        selectedWorkspace = {
          workspace: instance.workspace,
          workspacePath: instance.workspacePath,
          port: instance.port,
          pid: instance.pid,
        };
        antigravityHealth = await getAntigravityHealth(await getClient());
        workspaceMatch = checkAntigravityWorkspaceMatch(
          getResolvedTargetWorkspace(),
          instance.workspacePath,
        );
        const configs =
          (
            antigravityHealth.user as {
              userStatus?: {
                cascadeModelConfigData?: { clientModelConfigs?: unknown[] };
              };
            }
          )?.userStatus?.cascadeModelConfigData?.clientModelConfigs ?? [];
        quotaPools = formatAntigravityQuotas(
          configs as Parameters<typeof formatAntigravityQuotas>[0],
        );
        antigravitySummary = {
          status: antigravityHealth.status,
          url: antigravityHealth.url,
          quotaPools,
        };
      } catch (error) {
        antigravitySummary = {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        };
      }

      let healthSnapshots: unknown[] | null = null;
      if (supabaseReachable) {
        try {
          healthSnapshots = await recordAllProviderHealth(getTargetWorkspacePath());
        } catch {
          healthSnapshots = null;
        }
      }

      const payload = verbose
        ? {
            bridgeVersion: BRIDGE_VERSION,
            bridgeFeatures: BRIDGE_FEATURES,
            supabase: { ...supabaseStatus, reachable: supabaseReachable },
            providers,
            selectedAntigravityWorkspace: selectedWorkspace,
            antigravityHealth,
            quotaPools,
            workspaceMatch,
            antigravityCascadePool: getCascadePoolStats(),
            circuitBreaker: getCircuitBreakerStats(),
            healthSnapshotsRecorded: healthSnapshots?.length ?? 0,
            targetWorkspace: getResolvedTargetWorkspace(),
            workspaceResolution: getWorkspaceResolutionDebug(),
            autoLaunchEnabled: isAntigravityAutoLaunchEnabled(),
            defaultCwd: process.env["BRIDGE_DEFAULT_CWD"] ?? process.cwd(),
          }
        : {
            bridgeVersion: BRIDGE_VERSION,
            providers: providers.map((provider) => ({
              provider: provider.provider,
              available: provider.available,
              authenticated: provider.authenticated,
              detail: provider.detail,
            })),
            workspace: {
              target: getResolvedTargetWorkspace(),
              match: workspaceMatch,
              selected: selectedWorkspace,
            },
            antigravity: antigravitySummary,
            circuitBreaker: getCircuitBreakerStats(),
            supabase: {
              configured: supabaseStatus.configured,
              reachable: supabaseReachable,
            },
            healthSnapshotsRecorded: healthSnapshots?.length ?? 0,
          };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "list_models",
    describeTool("list_models"),
    {
      provider: z
        .enum(["antigravity", "cursor"])
        .default("antigravity")
        .describe("Provider de modelos"),
    },
    async ({ provider }) => {
      if (provider === "cursor") {
        const dynamic = await probeCursorModels();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  provider,
                  defaultModel: DEFAULT_CURSOR_MODEL,
                  models: dynamic,
                  source: "dynamic_probe",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const models = await listAntigravityModels(await getClient());
      const configs = (models as { clientModelConfigs?: Array<{ label?: string; modelOrAlias?: { model?: string }; quotaInfo?: { remainingFraction?: number } }> }).clientModelConfigs ?? [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                provider,
                defaultModel: DEFAULT_ANTIGRAVITY_MODEL,
                modelRouter: {
                  summarize: pickAntigravityModel("summarize"),
                  implement: pickAntigravityModel("implement"),
                  review: pickAntigravityModel("review"),
                  architecture: pickAntigravityModel("architecture"),
                  general: pickAntigravityModel("general"),
                },
                models: configs.map((m) => ({
                  id: m.modelOrAlias?.model,
                  label: m.label,
                  quotaRemaining: m.quotaInfo?.remainingFraction,
                })),
                inferExample: inferTaskCategory("implement feature X", true),
                raw: models,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "delegate_task",
    describeTool("delegate_task"),
    {
      provider: z.enum(["antigravity", "cursor"]),
      prompt: z.string(),
      model: z.string().optional(),
      mode: z.enum(["subagent", "bridge", "parallel"]).default("subagent").describe(MODE_DESC),
      agentic_mode: z.boolean().default(false).describe(AGENTIC_MODE_DESC),
      read_tools: z
        .boolean()
        .optional()
        .describe("Reservado para providers com modo read-only"),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      timeout_ms: z.number().default(120_000),
    },
    async (params) => {
      try {
        const denial = await guardDelegation(params.prompt, `delegate_task:${params.provider}`);
        if (denial) {
          return {
            content: [{ type: "text", text: JSON.stringify({ success: false, ...denial }, null, 2) }],
            isError: true,
          };
        }

        const result = await runDelegationWithFallback(params);
        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  provider: params.provider,
                  message: error instanceof Error ? error.message : String(error),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "delegate_and_wait",
    describeTool("delegate_and_wait"),
    {
      provider: z.enum(["antigravity", "cursor"]).default("antigravity"),
      prompt: z.string(),
      model: z.string().optional(),
      agentic_mode: z.boolean().default(false).describe(AGENTIC_MODE_DESC),
      mode: z.enum(["subagent", "bridge"]).default("subagent").describe(MODE_DESC),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      timeout_ms: z.number().default(120_000),
    },
    async (params) => {
      try {
        const denial = await guardDelegation(params.prompt, `delegate_and_wait:${params.provider}`);
        if (denial) {
          return { content: [{ type: "text", text: denial.message }], isError: true };
        }

        const result = await runDelegationWithFallback({ ...params, mode: params.mode });
        if (!result.success) {
          return { content: [{ type: "text", text: result.message }], isError: true };
        }
        return { content: [{ type: "text", text: result.response }] };
      } catch (error) {
        return {
          content: [
            { type: "text", text: error instanceof Error ? error.message : String(error) },
          ],
          isError: true,
        };
      }
    },
  );
}
