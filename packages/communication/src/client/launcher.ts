import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTargetWorkspacePath } from "./workspace.js";

const DEFAULT_LAUNCH_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 2_000;

function isAutoLaunchEnabled(): boolean {
  const value = process.env["BRIDGE_ANTIGRAVITY_AUTO_LAUNCH"];
  if (value === undefined || value === "") {
    return true;
  }
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function getLaunchTimeoutMs(): number {
  const raw = process.env["BRIDGE_LAUNCH_TIMEOUT_MS"];
  if (!raw) {
    return DEFAULT_LAUNCH_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LAUNCH_TIMEOUT_MS;
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
 * Localiza o launcher do Antigravity (agy) ou o executável da IDE.
 */
export function findAntigravityLauncher(): string | null {
  const envLauncher = process.env["BRIDGE_ANTIGRAVITY_LAUNCHER"];
  if (envLauncher?.trim() && fs.existsSync(envLauncher.trim())) {
    return envLauncher.trim();
  }

  if (commandExists("agy")) {
    return "agy";
  }

  const localAppData = process.env["LOCALAPPDATA"] ?? "";
  const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const candidates = [
    path.join(localAppData, "Programs", "Antigravity IDE", "bin", "antigravity-ide.cmd"),
    path.join(localAppData, "Programs", "Antigravity IDE", "Antigravity IDE.exe"),
    path.join(localAppData, "agy", "bin", "agy.exe"),
    path.join(localAppData, "Programs", "Antigravity", "Antigravity.exe"),
    path.join(localAppData, "Antigravity", "Antigravity.exe"),
    path.join(localAppData, "Programs", "Antigravity", "bin", "agy.exe"),
    path.join(programFiles, "Antigravity IDE", "bin", "antigravity-ide.cmd"),
    path.join(programFiles, "Antigravity IDE", "Antigravity IDE.exe"),
    "/usr/local/bin/agy",
    "/usr/local/bin/antigravity-ide",
    "/usr/bin/agy",
    "/usr/bin/antigravity",
  ];

  return firstExistingPath(candidates);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Abre o Antigravity no workspace informado (--new-window garante pasta correta).
 */
export function launchAntigravityIde(workspacePath: string, _hasOtherInstances: boolean): void {
  const launcher = findAntigravityLauncher();
  if (!launcher) {
    throw new Error(
      "Launcher do Antigravity não encontrado. Instale o comando de shell na IDE " +
        "(Command Palette → 'Shell Command: Install antigravity-ide command in PATH') " +
        "ou defina BRIDGE_ANTIGRAVITY_LAUNCHER.",
    );
  }

  const resolvedWorkspace = path.resolve(workspacePath);
  if (!fs.existsSync(resolvedWorkspace)) {
    throw new Error(`Workspace alvo não existe: ${resolvedWorkspace}`);
  }

  const args = ["--new-window", resolvedWorkspace];

  const isWindowsScript =
    process.platform === "win32" &&
    (launcher.toLowerCase().endsWith(".cmd") || launcher.toLowerCase().endsWith(".bat"));

  const child = isWindowsScript
    ? spawn("cmd.exe", ["/c", launcher, ...args], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      })
    : spawn(launcher, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
  child.unref();
}

export function isAntigravityAutoLaunchEnabled(): boolean {
  return isAutoLaunchEnabled();
}

export function getAntigravityLaunchTimeoutMs(): number {
  return getLaunchTimeoutMs();
}

export async function waitForLaunchDelay(): Promise<void> {
  await sleep(POLL_INTERVAL_MS);
}

export function describeLaunchTarget(): string {
  return getTargetWorkspacePath();
}
