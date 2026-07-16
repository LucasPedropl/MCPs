import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AGENT_OS_VERSION, jsonText } from "@mcps/shared";
import {
  getAgentOsConfigDir,
  getAgentOsHost,
  getEnabledModules,
  getMcpResultMaxChars,
  getSupabaseKeyRole,
  getToolDocsMode,
  isTelemetryEnabled,
} from "../config/env.js";
import { isSupabaseConfigured, probeSupabaseConnection } from "../features/supabase-client.js";
import { getWorkspaceResolutionDebug } from "../modules/orchestration/client/workspace.js";
import { buildUsageReport } from "../modules/telemetry/usage-report.js";
import { AGENT_OS_INSTRUCTIONS } from "./instructions.js";
import { describeAgentTool, getFullToolDoc } from "./tool-docs.js";
import { listHiddenTools } from "./tool-filter.js";
import { listRegisteredTools } from "./tool-telemetry.js";

export { AGENT_OS_INSTRUCTIONS } from "./instructions.js";

async function buildDynamicStatusSection(): Promise<string> {
  const enabledModules = [...getEnabledModules()];
  const supabaseConfigured = isSupabaseConfigured();
  const keyRole = getSupabaseKeyRole();
  const reachable = supabaseConfigured ? await probeSupabaseConnection() : false;

  const lines = [
    "## Status atual (dinâmico)",
    "",
    `- Módulos habilitados: ${enabledModules.join(", ")}`,
    `- Supabase: ${supabaseConfigured ? (reachable ? "configurado e alcançável" : "configurado mas INALCANÇÁVEL") : "NÃO configurado — memória/policies/jobs indisponíveis"}`,
    `- Key role: ${keyRole ?? "desconhecido"}${keyRole && keyRole !== "service_role" ? " (AVISO: escrita em agent_projects bloqueada por RLS)" : ""}`,
    `- Config dir: ${getAgentOsConfigDir()}`,
    `- Host (AGENT_OS_HOST): ${getAgentOsHost()}`,
    `- Telemetria: ${isTelemetryEnabled() ? "ligada" : "desligada (AGENT_OS_TELEMETRY=0)"}`,
  ];
  return lines.join("\n");
}

export function registerCoreTools(server: McpServer): void {
  server.registerTool(
    "agent_os_status",
    {
      description: describeAgentTool("agent_os_status"),
      inputSchema: {},
    },
    async () => {
      const supabaseReachable = isSupabaseConfigured()
        ? await probeSupabaseConnection()
        : false;

      return jsonText({
        name: "agent-os",
        version: AGENT_OS_VERSION,
        configDir: getAgentOsConfigDir(),
        enabledModules: [...getEnabledModules()],
        host: getAgentOsHost(),
        telemetryEnabled: isTelemetryEnabled(),
        supabase: {
          configured: isSupabaseConfigured(),
          reachable: supabaseReachable,
          keyRole: getSupabaseKeyRole(),
        },
        workspace: getWorkspaceResolutionDebug(),
        toolDocsMode: getToolDocsMode(),
        mcpResultMaxChars: getMcpResultMaxChars(),
        hiddenTools: listHiddenTools(),
        registeredToolsCount: listRegisteredTools().length,
      });
    },
  );

  server.registerTool(
    "get_usage_guide",
    {
      description: describeAgentTool("get_usage_guide"),
      inputSchema: {
        tool_name: z
          .string()
          .optional()
          .describe("Doc completa de UMA tool (WHEN TO USE/WHEN NOT/RETURNS/PARAMS/NOTES)"),
      },
    },
    async (args) => {
      if (args.tool_name) {
        const doc = getFullToolDoc(args.tool_name);
        return {
          content: [
            {
              type: "text" as const,
              text:
                doc ??
                `Tool '${args.tool_name}' sem doc registrada. Chame get_usage_guide sem tool_name para o guia geral.`,
            },
          ],
        };
      }
      const dynamicSection = await buildDynamicStatusSection();
      return {
        content: [
          { type: "text" as const, text: `${AGENT_OS_INSTRUCTIONS}\n\n${dynamicSection}` },
        ],
      };
    },
  );

  server.registerTool(
    "mcp_usage_stats",
    {
      description: describeAgentTool("mcp_usage_stats"),
      inputSchema: {
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .optional()
          .describe("Janela em dias (default 30)"),
        host: z
          .enum(["cursor", "antigravity", "claude_code", "unknown"])
          .optional()
          .describe("Filtrar por host (AGENT_OS_HOST)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Quantidade no top_tools/proxies (default 20)"),
      },
    },
    async (args) => {
      if (!isSupabaseConfigured()) {
        return {
          ...jsonText({
            success: false,
            message:
              "Supabase não configurado — telemetria indisponível. Defina AGENT_OS_SUPABASE_URL e AGENT_OS_SUPABASE_KEY.",
          }),
          isError: true,
        };
      }

      try {
        const report = await buildUsageReport({
          days: args.days,
          host: args.host,
          limit: args.limit,
          registeredTools: listRegisteredTools(),
          hiddenTools: listHiddenTools(),
        });
        return jsonText({
          success: true,
          host_process: getAgentOsHost(),
          telemetry_enabled: isTelemetryEnabled(),
          ...report,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ...jsonText({ success: false, message }),
          isError: true,
        };
      }
    },
  );
}
