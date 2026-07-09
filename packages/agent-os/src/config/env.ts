/** Unified env resolution for Agent OS (with legacy BRIDGE_* / SUPABASE_HUB_* fallbacks). */

const DEFAULT_SUPABASE_URL = "https://xrjjzyfevbuuxeundgds.supabase.co";

export function envFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function getAgentOsSupabaseUrl(): string {
  return (
    envFirst(
      "AGENT_OS_SUPABASE_URL",
      "BRIDGE_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL",
    ) ?? DEFAULT_SUPABASE_URL
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
