import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "@mcps/shared";
import type { ActiveContext } from "./features/accounts/schemas/account.schema.js";
import { loadConfig } from "./features/accounts/services/account-store.js";
import { callSupabaseTool } from "./features/proxy/supabase-mcp-proxy.js";
import { registerUnifiedHubTools } from "./tools/hub-tools-unified.js";
import { describeAgentTool } from "../../tools/tool-docs.js";

interface SchemaHint {
  table: string;
  columns: string[];
  note?: string;
}

const FALLBACK_TABLES = [
  "agent_preferences",
  "agent_decisions",
  "agent_skills",
  "delegation_jobs",
  "mcp_servers",
  "mcp_tools",
];

function parseListTablesResult(result: unknown): SchemaHint[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const record = result as { content?: Array<{ type?: string; text?: string }> };
  const textBlock = record.content?.find((block) => block.type === "text")?.text;
  if (!textBlock) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(textBlock);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): SchemaHint | null => {
        if (typeof item !== "object" || item === null || !("name" in item)) {
          return null;
        }
        const table = item as { name: string; columns?: Array<{ name: string }> };
        return {
          table: table.name,
          columns: (table.columns ?? []).map((column) => column.name),
        };
      })
      .filter((item): item is SchemaHint => item !== null);
  } catch {
    return [];
  }
}

function rankTablesByIntent(tables: SchemaHint[], intent: string, limit: number): SchemaHint[] {
  const keywords = intent
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);

  const ranked = [...tables].sort((left, right) => {
    const leftText = `${left.table} ${left.columns.join(" ")}`.toLowerCase();
    const rightText = `${right.table} ${right.columns.join(" ")}`.toLowerCase();
    const leftScore = keywords.filter((keyword) => leftText.includes(keyword)).length;
    const rightScore = keywords.filter((keyword) => rightText.includes(keyword)).length;
    return rightScore - leftScore;
  });

  if (keywords.length === 0) {
    return ranked.slice(0, limit);
  }

  const matched = ranked.filter((table) => {
    const haystack = `${table.table} ${table.columns.join(" ")}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });

  return (matched.length > 0 ? matched : ranked).slice(0, limit);
}

async function resolveSchemaHints(intent: string, tableLimit: number): Promise<{
  activeProject: ActiveContext | null;
  schemaHints: SchemaHint[];
  source: "list_tables" | "fallback";
}> {
  const config = await loadConfig();
  const limit = tableLimit;

  if (config.activeContext) {
    try {
      const remote = await callSupabaseTool("list_tables", { schemas: ["public"] });
      const tables = parseListTablesResult(remote);
      if (tables.length > 0) {
        return {
          activeProject: config.activeContext,
          schemaHints: rankTablesByIntent(tables, intent, limit),
          source: "list_tables",
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[schema_context_for_task] list_tables falhou: ${message}`);
    }
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
      });
    },
  );
}
