import * as path from "node:path";
import {
  agentOsEnv,
  getAgentOsConfigDir,
  getAgentOsSupabaseKey,
  getAgentOsSupabaseUrl,
} from "../../../../config/env.js";
import { getMonorepoRoot } from "../../../../config/paths.js";

export type McpExportTarget = "cursor" | "antigravity";
export type McpExportMode = "hub-only" | "multi-project";

export interface ExportMcpConfigOptions {
  target: McpExportTarget;
  mode?: McpExportMode;
  agentOsDistPath?: string;
  /** Default false: a key NÃO é embutida no JSON (vai placeholder). */
  includeSecrets?: boolean;
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

function agentOsEntry(distPath: string, includeSecrets: boolean): Record<string, unknown> {
  const env: Record<string, string> = {
    AGENT_OS_SUPABASE_URL: getAgentOsSupabaseUrl() ?? "<SUA_URL_SUPABASE>",
    AGENT_OS_DEFAULT_CWD: "${workspaceFolder}",
    AGENT_OS_REALTIME_WORKER: "0",
    SUPABASE_HUB_CONFIG_DIR: getAgentOsConfigDir().replace(/\\/g, "/"),
  };

  const key = getAgentOsSupabaseKey();
  if (key) {
    // A key real só entra com opt-in explícito — o retorno desta tool vai
    // parar no contexto da conversa do modelo.
    env.AGENT_OS_SUPABASE_KEY = includeSecrets ? key : "<COLE_SUA_AGENT_OS_SUPABASE_KEY>";
  }

  const antigravityLauncher = agentOsEnv("ANTIGRAVITY_LAUNCHER");
  if (antigravityLauncher) {
    env.AGENT_OS_ANTIGRAVITY_LAUNCHER = antigravityLauncher.replace(/\\/g, "/");
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
  const includeSecrets = options.includeSecrets ?? false;
  const notes: string[] = [
    "Personal Agent OS unificado — substitui supabase-hub e communication.",
    "Use list_connected_mcps + call_mcp_tool para GitHub, Vercel e OpenAPI.",
    "Troque projetos Supabase via switch_project (não precisa de MCP separado).",
  ];

  if (!includeSecrets) {
    notes.push(
      "AGENT_OS_SUPABASE_KEY veio como placeholder — substitua pela sua key ao colar (ou use include_secrets=true por sua conta e risco).",
    );
  }

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
      "agent-os": agentOsEntry(distPath, includeSecrets),
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
