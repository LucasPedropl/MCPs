import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AGENT_OS_VERSION, jsonText } from "@mcps/shared";
import {
  getAgentOsConfigDir,
  getEnabledModules,
  getSupabaseKeyRole,
} from "../config/env.js";
import { isSupabaseConfigured, probeSupabaseConnection } from "../features/supabase-client.js";
import { getWorkspaceResolutionDebug } from "../modules/orchestration/client/workspace.js";
import { AGENT_OS_INSTRUCTIONS } from "./instructions.js";
import { describeAgentTool } from "./tool-docs.js";

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
        supabase: {
          configured: isSupabaseConfigured(),
          reachable: supabaseReachable,
          keyRole: getSupabaseKeyRole(),
        },
        workspace: getWorkspaceResolutionDebug(),
      });
    },
  );

  server.registerTool(
    "get_usage_guide",
    {
      description: describeAgentTool("get_usage_guide"),
      inputSchema: {},
    },
    async () => {
      const dynamicSection = await buildDynamicStatusSection();
      return {
        content: [
          { type: "text", text: `${AGENT_OS_INSTRUCTIONS}\n\n${dynamicSection}` },
        ],
      };
    },
  );
}
