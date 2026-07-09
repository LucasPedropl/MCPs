import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface CursorCliInfo {
  command: string;
  source: "path" | "local-app-data" | "env";
}

function commandExists(command: string): boolean {
  try {
    if (process.platform === "win32") {
      execSync(`where ${command}`, { stdio: "ignore", windowsHide: true });
    } else {
      execSync(`command -v ${command}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function firstExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Localiza o binário do Cursor Agent CLI (agent / cursor-agent).
 */
export function findCursorAgentCli(): CursorCliInfo | null {
  const envCli = process.env["BRIDGE_CURSOR_AGENT_CLI"];
  if (envCli?.trim() && fs.existsSync(envCli.trim())) {
    return { command: envCli.trim(), source: "env" };
  }

  for (const name of ["agent", "cursor-agent"]) {
    if (commandExists(name)) {
      return { command: name, source: "path" };
    }
  }

  const localAppData = process.env["LOCALAPPDATA"] ?? "";
  const candidates = [
    path.join(localAppData, "cursor-agent", "agent.cmd"),
    path.join(localAppData, "cursor-agent", "cursor-agent.cmd"),
    path.join(localAppData, "Programs", "cursor-agent", "agent.cmd"),
    "/usr/local/bin/agent",
    "/usr/local/bin/cursor-agent",
  ];

  const found = firstExistingPath(candidates);
  if (found) {
    return { command: found, source: "local-app-data" };
  }

  return null;
}

export function isWindowsScript(command: string): boolean {
  const lower = command.toLowerCase();
  return lower.endsWith(".cmd") || lower.endsWith(".bat");
}
