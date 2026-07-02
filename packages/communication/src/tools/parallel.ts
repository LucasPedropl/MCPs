import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";
import { enqueueJob } from "../features/jobs/job-runner.js";
import { appendJobEvent } from "../features/jobs/job-store.js";
import { isSupabaseConfigured } from "../features/jobs/supabase-client.js";
import {
  createParallelJob,
  runParallelDelegation,
} from "../features/parallel/parallel-runner.js";
import { getRouteInfo, routeProviders } from "../features/parallel/router.js";
import type { MergeStrategy, ParallelProviderSpec } from "../features/parallel/types.js";
import { describeTool, WORKSPACE_PATH_DESC } from "./tool-docs.js";

const providerSpecSchema = z.object({
  provider: z.enum(["antigravity", "cursor", "copilot"]),
  model: z.string().optional(),
  agentic_mode: z.boolean().optional(),
  mode: z.enum(["subagent", "bridge"]).optional(),
});

function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function resolveProviders(
  prompt: string,
  autoRoute: boolean,
  explicit?: ParallelProviderSpec[],
): { providers: ParallelProviderSpec[]; routeInfo?: ReturnType<typeof getRouteInfo> } {
  if (explicit && explicit.length > 0) {
    return { providers: explicit };
  }
  if (autoRoute) {
    const routeInfo = getRouteInfo(prompt);
    return { providers: routeInfo.providers, routeInfo };
  }
  return { providers: routeProviders(prompt) };
}

export function registerParallelTools(server: McpServer): void {
  server.tool(
    "delegate_parallel",
    describeTool("delegate_parallel"),
    {
      prompt: z.string().min(1),
      providers: z.array(providerSpecSchema).optional(),
      auto_route: z
        .boolean()
        .default(true)
        .describe("Se true e providers omitido, escolhe providers pelo tipo de prompt"),
      merge_strategy: z
        .enum(["raw_all", "best_of", "consensus"])
        .default("best_of"),
      timeout_ms: z.number().default(180_000),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      async: z
        .boolean()
        .default(false)
        .describe("Se true, enfileira job paralelo no Supabase"),
    },
    async ({ prompt, providers, auto_route, merge_strategy, timeout_ms, workspace_path, async: runAsync }) => {
      try {
        const { providers: resolved, routeInfo } = resolveProviders(
          prompt,
          auto_route,
          providers,
        );

        if (resolved.length === 0) {
          return {
            ...jsonContent({ success: false, message: "Nenhum provider selecionado." }),
            isError: true,
          };
        }

        const input = {
          prompt,
          providers: resolved,
          mergeStrategy: merge_strategy as MergeStrategy,
          timeout_ms,
        };

        if (runAsync) {
          if (!isSupabaseConfigured()) {
            throw new Error(
              "Supabase não configurado. Necessário para delegate_parallel async.",
            );
          }

          const workspace = resolveWorkspacePath(workspace_path);
          const { parentJobId, childJobIds } = await createParallelJob(workspace, input, {
            routeCategory: routeInfo?.category,
            autoRouted: auto_route && !providers,
          });

          await appendJobEvent(parentJobId, "created", {
            type: "parallel",
            childJobIds,
            mergeStrategy: merge_strategy,
          });
          enqueueJob(parentJobId);

          return jsonContent({
            success: true,
            async: true,
            jobId: parentJobId,
            childJobIds,
            providers: resolved.map((p) => p.provider),
            mergeStrategy: merge_strategy,
            routeCategory: routeInfo?.category,
            message: "Job paralelo enfileirado. Use get_job_status para acompanhar.",
          });
        }

        const result = await runParallelDelegation(input);

        return jsonContent({
          success: result.successCount > 0,
          async: false,
          mergeStrategy: merge_strategy,
          routeCategory: routeInfo?.category,
          providers: resolved.map((p) => p.provider),
          winnerProvider: result.winnerProvider,
          consensusScore: result.consensusScore,
          successCount: result.successCount,
          failureCount: result.failureCount,
          merged: result.merged,
          providerResults: result.providerResults,
        });
      } catch (error) {
        return {
          ...jsonContent({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );

  server.tool(
    "route_prompt",
    describeTool("route_prompt"),
    {
      prompt: z.string().min(1),
    },
    async ({ prompt }) => {
      const routeInfo = getRouteInfo(prompt);
      return jsonContent({
        success: true,
        category: routeInfo.category,
        suggestedProviders: routeInfo.providers.map((p) => p.provider),
        hint:
          routeInfo.category === "review"
            ? "Review: Copilot + Antigravity"
            : routeInfo.category === "implement"
              ? "Implementação: Antigravity + Cursor"
              : routeInfo.category === "explain"
                ? "Explicação: Copilot + Antigravity"
                : "Geral: todos os providers",
      });
    },
  );
}
