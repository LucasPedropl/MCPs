import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./account-store.js";
import type { ActiveContext } from "../schemas/account.schema.js";

export interface HubStatusInfo {
  version: string;
  accountsCount: number;
  projectsCount: number;
  activeContext: ActiveContext | null;
  keepAliveEntries: number;
  schedulerRunning: boolean;
  configPath: string;
}

let schedulerRunning = false;

export function setSchedulerRunning(running: boolean): void {
  schedulerRunning = running;
}

/** Resolves the config file path (mirrors account-store logic). */
function resolveConfigPath(): string {
  const custom = process.env["SUPABASE_HUB_CONFIG_DIR"];
  if (custom) {
    return join(custom, "config.json");
  }
  return join(homedir(), ".supabase-mcp-hub", "config.json");
}

/** Returns a snapshot of the hub's current status. */
export async function getHubStatus(): Promise<HubStatusInfo> {
  const config = await loadConfig();

  return {
    version: "0.1.0",
    accountsCount: config.accounts.length,
    projectsCount: config.projects.length,
    activeContext: config.activeContext,
    keepAliveEntries: config.keepAlive.length,
    schedulerRunning,
    configPath: resolveConfigPath(),
  };
}

/** Reads legacy Cursor mcp.json for the single-project supabase entry. */
export async function readLegacySupabaseMcpConfig(): Promise<{
  projectRef: string | null;
  hasPat: boolean;
}> {
  const cursorConfig = join(
    process.env["USERPROFILE"] ?? homedir(),
    ".cursor",
    "mcp.json",
  );

  try {
    const raw = await readFile(cursorConfig, "utf8");
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<
        string,
        { url?: string; headers?: Record<string, string> }
      >;
    };
    const supabase = parsed.mcpServers?.["supabase"];
    if (!supabase?.url) {
      return { projectRef: null, hasPat: false };
    }

    const url = new URL(supabase.url);
    const projectRef = url.searchParams.get("project_ref");
    const auth = supabase.headers?.["Authorization"] ?? "";
    return {
      projectRef,
      hasPat: auth.startsWith("Bearer ") && auth.length > 20,
    };
  } catch {
    return { projectRef: null, hasPat: false };
  }
}
