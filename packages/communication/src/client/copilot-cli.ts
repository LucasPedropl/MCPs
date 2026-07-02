import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface CopilotCliInfo {
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

/** No Windows, `spawn("copilot")` falha; resolve para o .cmd/.exe real do `where`. */
function resolveWindowsCommand(name: string): string | null {
  try {
    const output = execSync(`where ${name}`, {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const script = lines.find((line) => /\.(cmd|bat|exe)$/i.test(line));
    return script ?? lines[0] ?? null;
  } catch {
    return null;
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
 * Localiza o binário do GitHub Copilot CLI.
 */
export function findCopilotCli(): CopilotCliInfo | null {
  const envCli = process.env["BRIDGE_COPILOT_CLI"];
  if (envCli?.trim() && fs.existsSync(envCli.trim())) {
    return { command: envCli.trim(), source: "env" };
  }

  for (const name of ["copilot", "github-copilot-cli"]) {
    if (commandExists(name)) {
      if (process.platform === "win32") {
        const resolved = resolveWindowsCommand(name);
        if (resolved) {
          return { command: resolved, source: "path" };
        }
      }
      return { command: name, source: "path" };
    }
  }

  const localAppData = process.env["LOCALAPPDATA"] ?? "";
  const appData = process.env["APPDATA"] ?? "";
  const candidates = [
    path.join(appData, "npm", "copilot.cmd"),
    path.join(localAppData, "Programs", "copilot", "copilot.cmd"),
    path.join(localAppData, "Programs", "github-copilot-cli", "copilot.cmd"),
    "/usr/local/bin/copilot",
    "/usr/local/bin/github-copilot-cli",
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
