/** Unified env resolution for Agent OS (with legacy BRIDGE_* / SUPABASE_HUB_* fallbacks). */

export function envFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

/** Lê env com prefixo novo AGENT_OS_ e fallback no legado BRIDGE_. */
export function agentOsEnv(suffix: string): string | undefined {
  return envFirst(`AGENT_OS_${suffix}`, `BRIDGE_${suffix}`);
}

/** Sem default embutido: URL de projeto pessoal hardcoded faria qualquer
 * instalação sem env conectar no Supabase errado. */
export function getAgentOsSupabaseUrl(): string | null {
  return (
    envFirst(
      "AGENT_OS_SUPABASE_URL",
      "BRIDGE_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL",
    ) ?? null
  );
}

export function getAgentOsSupabaseKey(): string | null {
  return (
    envFirst(
      "AGENT_OS_SUPABASE_KEY",
      "AGENT_OS_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "BRIDGE_SUPABASE_KEY",
      "BRIDGE_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ) ?? null
  );
}

export function getDefaultWorkspaceCwd(): string | undefined {
  return envFirst(
    "AGENT_OS_DEFAULT_CWD",
    "BRIDGE_DEFAULT_CWD",
    "ANTIGRAVITY_WORKSPACE",
  );
}

export function getAgentOsConfigDir(): string {
  const custom = envFirst("AGENT_OS_CONFIG_DIR", "SUPABASE_HUB_CONFIG_DIR");
  if (custom) {
    return custom;
  }
  const home = process.env["USERPROFILE"] ?? process.env["HOME"] ?? "";
  return `${home}/.agent-os`;
}

export function isRealtimeWorkerEnabled(): boolean {
  return (
    envFirst("AGENT_OS_REALTIME_WORKER", "BRIDGE_REALTIME_WORKER") === "1"
  );
}

export function isKeepAliveWorkerEnabled(): boolean {
  return envFirst("AGENT_OS_KEEPALIVE_WORKER") === "1";
}

const DEFAULT_MCP_RESULT_MAX_CHARS = 25_000;

/**
 * Cap de chars para resultados de tools proxy (call_mcp_tool, call_supabase_tool).
 * Env AGENT_OS_MCP_RESULT_MAX_CHARS; <=0 desliga o guard.
 */
export function getMcpResultMaxChars(): number {
  const raw = envFirst("AGENT_OS_MCP_RESULT_MAX_CHARS");
  if (!raw) {
    return DEFAULT_MCP_RESULT_MAX_CHARS;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    console.error(
      `[agent-os] AGENT_OS_MCP_RESULT_MAX_CHARS inválido ('${raw}') — usando default ${DEFAULT_MCP_RESULT_MAX_CHARS}.`,
    );
    return DEFAULT_MCP_RESULT_MAX_CHARS;
  }
  return parsed;
}

export type ToolDocsMode = "compact" | "full";

/** Env AGENT_OS_TOOL_DOCS: compact (default) | full (rollback sem rebuild). */
export function getToolDocsMode(): ToolDocsMode {
  const raw = envFirst("AGENT_OS_TOOL_DOCS")?.toLowerCase();
  return raw === "full" ? "full" : "compact";
}

export interface ToolFilter {
  allow: Set<string>;
  deny: Set<string>;
  active: boolean;
}

/**
 * Envs AGENT_OS_TOOLS_ALLOW / AGENT_OS_TOOLS_DENY (csv de nomes de tool).
 * Allow não-vazio = só esses; deny remove depois. Default: sem filtro.
 */
export function getToolFilter(): ToolFilter {
  const parseCsv = (value: string | undefined): Set<string> =>
    new Set(
      (value ?? "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean),
    );

  const allow = parseCsv(envFirst("AGENT_OS_TOOLS_ALLOW"));
  const deny = parseCsv(envFirst("AGENT_OS_TOOLS_DENY"));
  return { allow, deny, active: allow.size > 0 || deny.size > 0 };
}

export const AGENT_OS_MODULES = [
  "memory",
  "bootstrap",
  "context",
  "knowledge",
  "mcp_hub",
  "runner",
  "orchestration",
  "data",
  "policy",
  "projects",
] as const;

export type AgentOsModule = (typeof AGENT_OS_MODULES)[number];

/**
 * Resolve módulos habilitados via AGENT_OS_MODULES (csv).
 * Ex: "memory,context,data". Ausente ou "all" habilita tudo.
 * O módulo core (status + usage guide) é sempre registrado.
 */
export function getEnabledModules(): Set<AgentOsModule> {
  const raw = envFirst("AGENT_OS_MODULES");
  if (!raw || raw.toLowerCase() === "all") {
    return new Set(AGENT_OS_MODULES);
  }

  const requested = raw
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const enabled = new Set<AgentOsModule>();
  for (const token of requested) {
    const match = AGENT_OS_MODULES.find((module) => module === token);
    if (match) {
      enabled.add(match);
    } else {
      console.error(`[agent-os] AGENT_OS_MODULES: módulo desconhecido '${token}' ignorado.`);
    }
  }
  return enabled;
}

export type AgentOsHost = "cursor" | "antigravity" | "claude_code" | "unknown";

const AGENT_OS_HOSTS = new Set<AgentOsHost>([
  "cursor",
  "antigravity",
  "claude_code",
  "unknown",
]);

/**
 * Host que está rodando este processo MCP (via AGENT_OS_HOST no mcp.json).
 * Sem env → unknown (breakdown por IDE fica inútil até configurar).
 */
export function getAgentOsHost(): AgentOsHost {
  const raw = envFirst("AGENT_OS_HOST")?.toLowerCase();
  if (!raw) {
    return "unknown";
  }
  if (AGENT_OS_HOSTS.has(raw as AgentOsHost)) {
    return raw as AgentOsHost;
  }
  console.error(
    `[agent-os] AGENT_OS_HOST inválido ('${raw}') — usando 'unknown'. ` +
      "Valores: cursor | antigravity | claude_code.",
  );
  return "unknown";
}

/** Kill switch: AGENT_OS_TELEMETRY=0 desliga gravação de tool events. */
export function isTelemetryEnabled(): boolean {
  const raw = envFirst("AGENT_OS_TELEMETRY");
  if (raw === undefined) {
    return true;
  }
  return raw !== "0" && raw.toLowerCase() !== "false";
}

/** Decodifica o payload do JWT Supabase para inspecionar o role da key. */
export function getSupabaseKeyRole(): string | null {
  const key = getAgentOsSupabaseKey();
  if (!key) {
    return null;
  }
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}
