import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "@mcps/shared";
import type { ActiveContext } from "./features/accounts/schemas/account.schema.js";
import { loadConfig } from "./features/accounts/services/account-store.js";
import { callSupabaseTool } from "./features/proxy/supabase-mcp-proxy.js";
import { registerUnifiedHubTools } from "./tools/hub-tools-unified.js";
import { describeAgentTool } from "../../tools/tool-docs.js";
import { parseListTablesResult, rankTablesByIntent, type SchemaHint } from "./schema-parser.js";

const FALLBACK_TABLES = [
  "agent_preferences",
  "agent_decisions",
  "agent_skills",
  "delegation_jobs",
  "mcp_servers",
  "mcp_tools",
];

async function resolveSchemaHints(intent: string, tableLimit: number): Promise<{
  activeProject: ActiveContext | null;
  schemaHints: SchemaHint[];
  source: "list_tables" | "fallback";
  error?: string;
}> {
  const config = await loadConfig();
  const limit = tableLimit;

  if (!config.activeContext) {
    return {
      activeProject: null,
      schemaHints: [],
      source: "fallback",
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

    console.warn(
      "[schema_context_for_task] list_tables retornou vazio — usando fallback estático.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[schema_context_for_task] list_tables falhou: ${message}`);
  }

  const keywords = intent
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);

  const matched = FALLBACK_TABLES.filter((table) =>
    keywords.some((keyword) => table.includes(keyword)),
  );

  const tables = (matched.length > 0 ? matched : FALLBACK_TABLES).slice(0, limit);

  return {
    activeProject: config.activeContext,
    schemaHints: tables.map((table) => ({
      table,
      columns: [],
      note: "Fallback estático — use switch_project + list_tables para detalhes.",
    })),
    source: "fallback",
  };
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
