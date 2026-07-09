import * as path from "node:path";
import { getAgentOsConfigDir, getAgentOsSupabaseKey, getAgentOsSupabaseUrl } from "../../../../config/env.js";
import { getMonorepoRoot } from "../../../../config/paths.js";

export type McpExportTarget = "cursor" | "antigravity";
export type McpExportMode = "hub-only" | "multi-project";

export interface ExportMcpConfigOptions {
  target: McpExportTarget;
  mode?: McpExportMode;
  agentOsDistPath?: string;
}

export interface ExportMcpConfigResult {
  mcpServers: Record<string, unknown>;
  notes: string[];
  configPath: string;
}

const DEFAULT_AGENT_OS_PATH = path.join(
  getMonorepoRoot(),
  "packages",
  "agent-os",
  "dist",
  "index.js",
).replace(/\\/g, "/");

function agentOsEntry(distPath: string): Record<string, unknown> {
  const env: Record<string, string> = {
    AGENT_OS_SUPABASE_URL: getAgentOsSupabaseUrl(),
    AGENT_OS_DEFAULT_CWD: "${workspaceFolder}",
    AGENT_OS_REALTIME_WORKER: "0",
    SUPABASE_HUB_CONFIG_DIR: getAgentOsConfigDir().replace(/\\/g, "/"),
  };

  const key = getAgentOsSupabaseKey();
  if (key) {
    env.AGENT_OS_SUPABASE_KEY = key;
  }

  const antigravityLauncher = process.env["BRIDGE_ANTIGRAVITY_LAUNCHER"];
  if (antigravityLauncher) {
    env.BRIDGE_ANTIGRAVITY_LAUNCHER = antigravityLauncher.replace(/\\/g, "/");
  }

  return {
    command: "node",
    args: [distPath],
    env,
  };
}

function configPathFor(target: McpExportTarget): string {
  const home = process.env["USERPROFILE"] ?? process.env["HOME"] ?? "~";
  if (target === "antigravity") {
    return `${home}/.gemini/config/mcp_config.json`;
  }
  return `${home}/.cursor/mcp.json`;
}

export async function exportMcpConfig(
  options: ExportMcpConfigOptions,
): Promise<ExportMcpConfigResult> {
  const distPath = (options.agentOsDistPath ?? DEFAULT_AGENT_OS_PATH).replace(/\\/g, "/");
  const notes: string[] = [
    "Personal Agent OS unificado — substitui supabase-hub e communication.",
    "Use list_connected_mcps + call_mcp_tool para GitHub, Vercel e OpenAPI.",
    "Troque projetos Supabase via switch_project (não precisa de MCP separado).",
  ];

  if (options.target === "antigravity") {
    notes.push(
      "Antigravity: cole em ~/.gemini/config/mcp_config.json (Manage MCP Servers → View raw config).",
      "Antigravity recomenda menos de 50 tools habilitadas — o hub lazy ajuda nisso.",
    );
  } else {
    notes.push("Cursor: cole em ~/.cursor/mcp.json e reinicie o MCP.");
  }

  if (options.mode === "multi-project") {
    notes.push(
      "Modo multi-project legado: use switch_project no agent-os em vez de vários MCPs Supabase.",
    );
  }

  return {
    mcpServers: {
      "agent-os": agentOsEntry(distPath),
    },
    notes,
    configPath: configPathFor(options.target),
  };
}

export async function exportAntigravityConfig(
  mode: McpExportMode = "hub-only",
): Promise<ExportMcpConfigResult> {
  return exportMcpConfig({ target: "antigravity", mode });
}

export async function exportCursorConfig(
  mode: McpExportMode = "hub-only",
): Promise<ExportMcpConfigResult> {
  return exportMcpConfig({ target: "cursor", mode });
}
