import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Hooks do Cursor rodam fora do processo MCP, sem o env do mcp.json.
 * Resolve credenciais Supabase nesta ordem:
 * 1. process.env (AGENT_OS_SUPABASE_URL/KEY)
 * 2. ~/.agent-os/hooks-env.json ({ "AGENT_OS_SUPABASE_URL": ..., "AGENT_OS_SUPABASE_KEY": ... })
 * 3. ~/.cursor/mcp.json (env do servidor agent-os/user-agent-os)
 */
export function resolveHookEnv(): void {
  if (process.env["AGENT_OS_SUPABASE_KEY"]?.trim()) {
    return;
  }

  const home = os.homedir();

  const hooksEnvPath = path.join(home, ".agent-os", "hooks-env.json");
  if (applyEnvFile(hooksEnvPath)) {
    return;
  }

  applyFromMcpJson(path.join(home, ".cursor", "mcp.json"));
}

function applyEnvFile(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    let applied = false;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && key.startsWith("AGENT_OS_") && !process.env[key]) {
        process.env[key] = value;
        applied = true;
      }
    }
    return applied && Boolean(process.env["AGENT_OS_SUPABASE_KEY"]);
  } catch {
    return false;
  }
}

interface McpJsonShape {
  mcpServers?: Record<string, { env?: Record<string, string> }>;
}

function applyFromMcpJson(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as McpJsonShape;
    const servers = parsed.mcpServers ?? {};

    for (const server of Object.values(servers)) {
      const env = server.env ?? {};
      if (env["AGENT_OS_SUPABASE_KEY"]) {
        for (const [key, value] of Object.entries(env)) {
          if (key.startsWith("AGENT_OS_") && !process.env[key]) {
            process.env[key] = value;
          }
        }
        return;
      }
    }
  } catch {
    // fail open — hook roda sem Supabase e retorna resultado vazio
  }
}
