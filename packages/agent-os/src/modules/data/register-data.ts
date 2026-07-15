import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "@mcps/shared";
import type { ActiveContext } from "./features/accounts/schemas/account.schema.js";
import { loadConfig } from "./features/accounts/services/account-store.js";
import { callSupabaseTool } from "./features/proxy/supabase-mcp-proxy.js";
import { registerUnifiedHubTools } from "./tools/hub-tools-unified.js";
import { describeAgentTool } from "../../tools/tool-docs.js";
import { parseListTablesResult, rankTablesByIntent, type SchemaHint } from "./schema-parser.js";

async function resolveSchemaHints(intent: string, tableLimit: number): Promise<{
  activeProject: ActiveContext | null;
  schemaHints: SchemaHint[];
  source: "list_tables" | "unavailable";
  error?: string;
}> {
  const config = await loadConfig();
  const limit = tableLimit;

  if (!config.activeContext) {
    return {
      activeProject: null,
      schemaHints: [],
      source: "unavailable",
      error: "Nenhum projeto ativo. Use switch_project antes de schema_context_for_task.",
    };
  }

  try {
    const remote = await callSupabaseTool("list_tables", {
      schemas: ["public"],
      verbose: true,
    });
    const tables = parseListTablesResult(remote);
    if (tables.length > 0) {
      return {
        activeProject: config.activeContext,
        schemaHints: rankTablesByIntent(tables, intent, limit),
        source: "list_tables",
      };
    }

    return {
      activeProject: config.activeContext,
      schemaHints: [],
      source: "unavailable",
      error:
        "list_tables retornou vazio — o schema public do projeto ativo não tem tabelas visíveis.",
    };
  } catch (error) {
    // Sem lista de fallback: sugerir tabelas do meta-banco do agent-os aqui
    // enganaria o modelo sobre o schema do projeto ATIVO do usuário.
    const message = error instanceof Error ? error.message : String(error);
    return {
      activeProject: config.activeContext,
      schemaHints: [],
      source: "unavailable",
      error: `list_tables falhou: ${message}. Verifique credenciais do projeto ativo (switch_project).`,
    };
  }
}

export function registerDataTools(server: McpServer): void {
  registerUnifiedHubTools(server);

  server.registerTool(
    "schema_context_for_task",
    {
      description: describeAgentTool("schema_context_for_task"),
      inputSchema: {
        intent: z.string(),
        table_limit: z.number().optional(),
      },
    },
    async (args) => {
      const resolved = await resolveSchemaHints(args.intent, args.table_limit ?? 5);
      return jsonText({
        active_project: resolved.activeProject,
        intent: args.intent,
        source: resolved.source,
        schema_hints: resolved.schemaHints,
        error: resolved.error,
      });
    },
  );
}
