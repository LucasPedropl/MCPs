import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "@mcps/shared";
import {
  rollbackTask,
  runAutofixLoop,
  runQualityGates,
  summarizeDiff,
} from "../modules/runner/runner-service.js";
import { runDelegation } from "../modules/orchestration/tools/delegation.js";
import { describeAgentTool } from "./tool-docs.js";

export function registerRunnerTools(server: McpServer): void {
  server.registerTool(
    "run_quality_gates",
    {
      description: describeAgentTool("run_quality_gates"),
      inputSchema: { workspace_path: z.string() },
    },
    async (args) => jsonText(await runQualityGates(args.workspace_path)),
  );

  server.registerTool(
    "summarize_diff",
    {
      description: describeAgentTool("summarize_diff"),
      inputSchema: { workspace_path: z.string() },
    },
    async (args) => jsonText({ summary: await summarizeDiff(args.workspace_path) }),
  );

  server.registerTool(
    "rollback_task",
    {
      description: describeAgentTool("rollback_task"),
      inputSchema: { workspace_path: z.string() },
    },
    async (args) => jsonText({ message: await rollbackTask(args.workspace_path) }),
  );

  server.registerTool(
    "run_autofix_loop",
    {
      description: describeAgentTool("run_autofix_loop"),
      inputSchema: {
        workspace_path: z.string(),
        prompt_prefix: z.string().optional(),
        max_iterations: z.number().optional(),
        provider: z.enum(["cursor", "antigravity", "copilot"]).optional(),
      },
    },
    async (args) => {
      const report = await runAutofixLoop({
        workspacePath: args.workspace_path,
        maxIterations: args.max_iterations,
        delegateFix: async (errorOutput) => {
          const prompt = [
            args.prompt_prefix ??
              "Corrija os erros abaixo sem alterar escopo além do necessário.",
            "",
            errorOutput,
          ].join("\n");

          const result = await runDelegation({
            prompt,
            provider: args.provider ?? "cursor",
            workspace_path: args.workspace_path,
            mode: "subagent",
            agentic_mode: true,
            timeout_ms: 300_000,
          });

          if (!result.success) {
            throw new Error(result.message);
          }
        },
      });

      return jsonText(report);
    },
  );
}
