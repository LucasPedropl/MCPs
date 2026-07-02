import { loadConfig } from "../accounts/services/account-store.js";

export type McpExportTarget = "cursor" | "antigravity";
export type McpExportMode = "hub-only" | "multi-project";

export interface ExportMcpConfigOptions {
  target: McpExportTarget;
  mode: McpExportMode;
  hubDistPath?: string;
}

const DEFAULT_HUB_PATH = "C:/codigo/pessoal/MCPsupabase/dist/index.js";

function hubEntry(distPath: string): Record<string, unknown> {
  const configDir =
    process.env["SUPABASE_HUB_CONFIG_DIR"] ??
    "C:/Users/Pedro/.supabase-mcp-hub";

  return {
    command: "node",
    args: [distPath],
    env: {
      SUPABASE_HUB_CONFIG_DIR: configDir,
      ...(process.env["SUPABASE_HUB_WEBHOOK_URL"]
        ? { SUPABASE_HUB_WEBHOOK_URL: process.env["SUPABASE_HUB_WEBHOOK_URL"] }
        : {}),
    },
  };
}

async function multiProjectEntries(): Promise<Record<string, unknown>> {
  const config = await loadConfig();
  const servers: Record<string, unknown> = {};

  for (const project of config.projects) {
    const account = config.accounts.find((a) => a.id === project.accountId);
    const key = `supabase-${account?.label ?? "account"}-${project.ref}`.replace(
      /[^a-zA-Z0-9-_]/g,
      "-",
    );
    servers[key] = {
      url: `https://mcp.supabase.com/mcp?project_ref=${project.ref}`,
      headers: {
        Authorization: `Bearer \${SUPABASE_PAT_${project.accountId.replace(/-/g, "_").toUpperCase()}}`,
      },
    };
  }

  return servers;
}

export async function exportMcpConfig(
  options: ExportMcpConfigOptions,
): Promise<{ mcpServers: Record<string, unknown>; notes: string[] }> {
  const distPath = options.hubDistPath ?? DEFAULT_HUB_PATH;
  const notes: string[] = [];

  if (options.mode === "hub-only") {
    return {
      mcpServers: {
        "supabase-hub": hubEntry(distPath),
      },
      notes: [
        "Modo hub-only: uma entrada MCP, troque projetos via switch_project.",
        "Remova a entrada supabase OAuth antiga para evitar conflito.",
      ],
    };
  }

  const config = await loadConfig();
  if (config.accounts.length === 0) {
    notes.push(
      "Nenhuma conta registrada. Use add_account antes do modo multi-project.",
    );
  }

  notes.push(
    "Modo multi-project: defina env vars SUPABASE_PAT_{ACCOUNT_ID} para cada conta.",
  );

  return {
    mcpServers: {
      "supabase-hub": hubEntry(distPath),
      ...(await multiProjectEntries()),
    },
    notes,
  };
}

export async function exportAntigravityConfig(
  mode: McpExportMode = "hub-only",
): Promise<Awaited<ReturnType<typeof exportMcpConfig>>> {
  return exportMcpConfig({ target: "antigravity", mode });
}
