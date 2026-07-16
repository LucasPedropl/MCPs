import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  errorText as sharedErrorText,
  guardedJsonText,
  jsonText,
  unwrapMcpResult,
} from "@mcps/shared";
import { getMcpResultMaxChars } from "../../../config/env.js";
import {
  addAccount,
  loadConfig,
  removeAccount,
  resolveAccountId,
  setActiveContext,
  syncAllProjects,
  syncProjectsForAccount,
  registerKeepAlive,
  registerAllKeepAlive,
  getAccountPat,
  updateHubSettings,
} from "../features/accounts/services/account-store.js";
import {
  createProject,
  listOrganizations,
  restoreProject,
  testPat,
} from "../features/accounts/services/management-api.js";
import {
  addAccountInputSchema,
  createProjectInputSchema,
  switchProjectInputSchema,
} from "../features/accounts/schemas/account.schema.js";
import {
  pingAllProjects,
  ensureKeepAliveRegistered,
} from "../features/projects/services/keepalive-service.js";
import {
  callSupabaseTool,
  getProxyToolNames,
  listRemoteTools,
} from "../features/proxy/supabase-mcp-proxy.js";
import {
  getHubStatus,
  readLegacySupabaseMcpConfig,
} from "../features/accounts/services/hub-status.js";
import { exportMcpConfig } from "../features/config/mcp-config-exporter.js";
import { buildKeepAliveStatusPayload } from "../hub-sanitize.js";
import { importFromLegacySupabase } from "../features/accounts/services/legacy-import.js";

export { jsonText };

export function errorText(message: string): ReturnType<typeof sharedErrorText> {
  console.error(`[supabase-hub] ${message}`);
  return sharedErrorText(message);
}

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "add_account",
    {
      description:
        "Registra uma conta Supabase com PAT. O token fica no Credential Manager.",
      inputSchema: addAccountInputSchema,
    },
    async (input) => {
      try {
        const account = await addAccount(input);
        return jsonText({ success: true, account });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "list_accounts",
    {
      description: "Lista contas registradas (labels e ids). Use os labels em switch_project.",
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
    "remove_account",
    {
      description: "Remove conta, projetos em cache e PAT associado.",
      inputSchema: z.object({ accountId: z.string().uuid() }),
    },
    async ({ accountId }) => {
      try {
        await removeAccount(accountId);
        return jsonText({ success: true, accountId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "test_account",
    {
      description: "Valida PAT de uma conta via Management API.",
      inputSchema: z.object({ accountId: z.string().uuid() }),
    },
    async ({ accountId }) => {
      try {
        const pat = await getAccountPat(accountId);
        const ok = await testPat(pat);
        return jsonText({ accountId, valid: ok });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );
}

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    "list_projects",
    {
      description: "Lista projetos em cache. Use sync_projects para atualizar.",
      inputSchema: z.object({
        accountId: z.string().uuid().optional(),
      }),
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
    "sync_projects",
    {
      description:
        "Sincroniza projetos de todas as contas (ou uma se accountId). " +
        "Rode após add_account e periodicamente. Tenta registrar keep-alive automaticamente.",
      inputSchema: z.object({
        accountId: z.string().uuid().optional(),
      }),
    },
    async ({ accountId }) => {
      try {
        const projects = accountId
          ? await syncProjectsForAccount(accountId)
          : await syncAllProjects();
        await ensureKeepAliveRegistered();
        return jsonText({ success: true, count: projects.length, projects });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "list_organizations",
    {
      description: "Lista organizações de uma conta via Management API.",
      inputSchema: z.object({ accountId: z.string().uuid() }),
    },
    async ({ accountId }) => {
      try {
        const pat = await getAccountPat(accountId);
        const orgs = await listOrganizations(pat);
        return jsonText({ accountId, organizations: orgs });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "switch_project",
    {
      description:
        "Alterna conta/projeto ativo. OBRIGATÓRIO antes de list_tables/execute_sql. " +
        "Use list_accounts + list_projects para descobrir accountLabel e projectRef. " +
        "Ex: { accountLabel: 'minha-org', projectRef: 'abc123' }. Confirme com get_active_project.",
      inputSchema: switchProjectInputSchema,
    },
    async (input) => {
      try {
        const accountId = await resolveAccountId(
          input.accountId,
          input.accountLabel,
        );
        const context = await setActiveContext(accountId, input.projectRef);
        return jsonText({ success: true, activeContext: context });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "get_active_project",
    {
      description:
        "Retorna conta e projeto ativos. SEMPRE consulte antes de execute_sql/list_tables " +
        "para confirmar que está no projeto correto.",
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
      return jsonText({
        active: true,
        account,
        project,
        activeContext: config.activeContext,
      });
    },
  );

  server.registerTool(
    "create_project",
    {
      description: "Cria um novo projeto Supabase via Management API.",
      inputSchema: createProjectInputSchema,
    },
    async (input) => {
      try {
        const pat = await getAccountPat(input.accountId);
        const created = await createProject(pat, input);
        await syncProjectsForAccount(input.accountId);
        await registerKeepAlive(input.accountId, created.ref);
        return jsonText({ success: true, project: created });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "restore_project",
    {
      description: "Reativa um projeto pausado.",
      inputSchema: z.object({
        accountId: z.string().uuid(),
        projectRef: z.string().min(1),
      }),
    },
    async ({ accountId, projectRef }) => {
      try {
        const pat = await getAccountPat(accountId);
        await restoreProject(pat, projectRef);
        return jsonText({ success: true, projectRef });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );
}

export function registerKeepAliveTools(server: McpServer): void {
  server.registerTool(
    "register_keepalive",
    {
      description: "Registra projeto para ping automático (evita pausa de 7 dias).",
      inputSchema: z.object({
        accountId: z.string().uuid(),
        projectRef: z.string().min(1),
      }),
    },
    async ({ accountId, projectRef }) => {
      try {
        const entry = await registerKeepAlive(accountId, projectRef);
        return jsonText({ success: true, entry });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "register_all_keepalive",
    {
      description:
        "Registra keep-alive em TODOS os projetos de TODAS as contas. " +
        "Rode após sync_projects. Evita pausa de 7 dias (free tier).",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const entries = await registerAllKeepAlive();
        return jsonText({ success: true, count: entries.length, entries });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "ping_all_projects",
    {
      description: "Executa ping manual em todos os projetos registrados.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const results = await pingAllProjects();
        return jsonText({ success: true, results });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "get_keepalive_status",
    {
      description: "Status do keep-alive de todos os projetos.",
      inputSchema: z.object({}),
    },
    async () => {
      const config = await loadConfig();
      return jsonText(buildKeepAliveStatusPayload(config.keepAlive));
    },
  );
}

export function registerSettingsTools(server: McpServer): void {
  server.registerTool(
    "update_hub_settings",
    {
      description: "Atualiza settings globais do supabase-hub (readOnly, keepAliveCron).",
      inputSchema: z.object({
        readOnly: z.boolean().optional(),
        keepAliveCron: z.string().min(1).optional(),
      }),
    },
    async (input) => {
      try {
        const settings = await updateHubSettings(input);
        return jsonText({ success: true, settings });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );
}

export function registerMetaTools(server: McpServer): void {
  server.registerTool(
    "hub_status",
    {
      description:
        "Visão geral: contas, projetos, contexto ativo, keep-alive, scheduler. " +
        "Bom ponto de partida para agentes.",
      inputSchema: z.object({}),
    },
    async () => jsonText(await getHubStatus()),
  );

  server.registerTool(
    "export_mcp_config",
    {
      description: "Gera snippet mcp.json para Cursor ou Antigravity.",
      inputSchema: z.object({
        target: z.enum(["cursor", "antigravity"]).default("cursor"),
        mode: z.enum(["hub-only", "multi-project"]).default("hub-only"),
        agentOsDistPath: z.string().optional(),
        include_secrets: z
          .boolean()
          .default(false)
          .describe("Se true, embute a AGENT_OS_SUPABASE_KEY real no JSON (default: placeholder)"),
      }),
    },
    async ({ target, mode, agentOsDistPath, include_secrets }) => {
      try {
        return jsonText(
          await exportMcpConfig({ target, mode, agentOsDistPath, includeSecrets: include_secrets }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "import_from_legacy_supabase",
    {
      description: "Importa conta via PAT e ativa project_ref legado.",
      inputSchema: z.object({
        pat: z.string().min(10).optional(),
        label: z.string().min(1).default("default"),
        projectRef: z.string().min(1).optional(),
      }),
    },
    async (input) => {
      try {
        const result = await importFromLegacySupabase(input);
        return jsonText({ success: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );
}

export function registerProxyTools(server: McpServer): void {
  server.registerTool(
    "call_supabase_tool",
    {
      description: "Chama qualquer tool do MCP Supabase oficial no projeto ativo.",
      inputSchema: z.object({
        tool_name: z
          .string()
          .min(1)
          .optional()
          .describe("Nome da tool remota do MCP Supabase (ex.: execute_sql)"),
        toolName: z.string().min(1).optional().describe("Alias legado de tool_name"),
        arguments: z.record(z.unknown()).default({}),
        max_chars: z
          .number()
          .optional()
          .describe("Cap de chars do resultado (default env AGENT_OS_MCP_RESULT_MAX_CHARS=25000; <=0 desliga)"),
      }),
    },
    async ({ tool_name, toolName, arguments: toolArgs, max_chars }) => {
      const name = tool_name ?? toolName;
      if (!name) {
        return sharedErrorText("Informe tool_name (ex.: execute_sql).");
      }
      try {
        const result = await callSupabaseTool(name, toolArgs);
        const guardOptions = {
          maxChars: max_chars ?? getMcpResultMaxChars(),
          hint: "; para execute_sql use LIMIT/colunas específicas; para get_logs estreite o intervalo",
        };
        const unwrapped = unwrapMcpResult(result);
        if (unwrapped) {
          const guarded = guardedJsonText(unwrapped.text, guardOptions);
          return unwrapped.isError ? { ...guarded, isError: true } : guarded;
        }
        return guardedJsonText(result, guardOptions);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  server.registerTool(
    "list_supabase_tools",
    {
      description: "Lista tools disponíveis no MCP remoto para o projeto ativo.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return jsonText({ tools: await listRemoteTools() });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorText(message);
      }
    },
  );

  for (const toolName of getProxyToolNames()) {
    server.registerTool(
      toolName,
      {
        description: `Proxy Supabase: ${toolName} (projeto ativo).`,
        inputSchema: z.object({}).passthrough(),
      },
      async (args) => {
        try {
          return guardedJsonText(
            await callSupabaseTool(toolName, args as Record<string, unknown>),
            { maxChars: getMcpResultMaxChars() },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return errorText(message);
        }
      },
    );
  }
}

export {
  loadConfig,
  registerKeepAlive,
  registerAllKeepAlive,
  getAccountPat,
  createProject,
  restoreProject,
  syncProjectsForAccount,
  ensureKeepAliveRegistered,
  pingAllProjects,
  callSupabaseTool,
  getProxyToolNames,
  listRemoteTools,
  getHubStatus,
  readLegacySupabaseMcpConfig,
  exportMcpConfig,
  addAccount,
  setActiveContext,
};
