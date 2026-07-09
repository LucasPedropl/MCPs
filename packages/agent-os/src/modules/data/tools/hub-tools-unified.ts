import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  loadConfig,
  resolveAccountId,
  setActiveContext,
} from "../features/accounts/services/account-store.js";
import { switchProjectInputSchema } from "../features/accounts/schemas/account.schema.js";
import {
  callSupabaseTool,
  listRemoteTools,
} from "../features/proxy/supabase-mcp-proxy.js";
import { getHubStatus } from "../features/accounts/services/hub-status.js";
import { exportMcpConfig } from "../features/config/mcp-config-exporter.js";
import { describeAgentTool } from "../../../tools/tool-docs.js";
import { errorText, jsonText } from "./hub-tools-core.js";
import { registerHubAdminTools } from "./hub-admin-tools.js";

/**
 * Registro consolidado do hub Supabase para o servidor unificado agent-os.
 * As 14 proxies diretas (list_tables, execute_sql, ...) ficam apenas no MCP
 * standalone supabase-hub; aqui tudo passa por call_supabase_tool.
 */
export function registerUnifiedHubTools(server: McpServer): void {
  server.registerTool(
    "hub_status",
    {
      description: describeAgentTool("hub_status"),
      inputSchema: z.object({}),
    },
    async () => jsonText(await getHubStatus()),
  );

  server.registerTool(
    "list_accounts",
    {
      description: describeAgentTool("list_accounts"),
      inputSchema: z.object({}),
    },
    async () => {
      const config = await loadConfig();
      return jsonText({
        count: config.accounts.length,
        accounts: config.accounts,
        activeContext: config.activeContext,
      });
    },
  );

  server.registerTool(
    "list_projects",
    {
      description: describeAgentTool("list_projects"),
      inputSchema: z.object({ accountId: z.string().uuid().optional() }),
    },
    async ({ accountId }) => {
      const config = await loadConfig();
      const projects = accountId
        ? config.projects.filter((p) => p.accountId === accountId)
        : config.projects;
      return jsonText({ count: projects.length, projects });
    },
  );

  server.registerTool(
    "switch_project",
    {
      description: describeAgentTool("switch_project"),
      inputSchema: switchProjectInputSchema,
    },
    async (input) => {
      try {
        const accountId = await resolveAccountId(input.accountId, input.accountLabel);
        const context = await setActiveContext(accountId, input.projectRef);
        return jsonText({ success: true, activeContext: context });
      } catch (error) {
        return errorText(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "get_active_project",
    {
      description: describeAgentTool("get_active_project"),
      inputSchema: z.object({}),
    },
    async () => {
      const config = await loadConfig();
      if (!config.activeContext) {
        return jsonText({ active: false, message: "Nenhum projeto selecionado." });
      }
      const account = config.accounts.find(
        (a) => a.id === config.activeContext?.accountId,
      );
      const project = config.projects.find(
        (p) =>
          p.accountId === config.activeContext?.accountId &&
          p.ref === config.activeContext?.projectRef,
      );
      return jsonText({ active: true, account, project, activeContext: config.activeContext });
    },
  );

  server.registerTool(
    "call_supabase_tool",
    {
      description: describeAgentTool("call_supabase_tool"),
      inputSchema: z.object({
        toolName: z.string().min(1),
        arguments: z.record(z.unknown()).default({}),
      }),
    },
    async ({ toolName, arguments: toolArgs }) => {
      try {
        return jsonText(await callSupabaseTool(toolName, toolArgs));
      } catch (error) {
        return errorText(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "list_supabase_tools",
    {
      description: describeAgentTool("list_supabase_tools"),
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return jsonText({ tools: await listRemoteTools() });
      } catch (error) {
        return errorText(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "export_mcp_config",
    {
      description: describeAgentTool("export_mcp_config"),
      inputSchema: z.object({
        target: z.enum(["cursor", "antigravity"]).default("cursor"),
        mode: z.enum(["hub-only", "multi-project"]).default("hub-only"),
        agentOsDistPath: z.string().optional(),
      }),
    },
    async ({ target, mode, agentOsDistPath }) => {
      try {
        return jsonText(await exportMcpConfig({ target, mode, agentOsDistPath }));
      } catch (error) {
        return errorText(error instanceof Error ? error.message : String(error));
      }
    },
  );

  registerHubAdminTools(server);
}
