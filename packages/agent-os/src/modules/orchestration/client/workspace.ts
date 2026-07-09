import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function looksLikeFilesystemPath(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    /^[a-zA-Z]:/.test(value)
  );
}

function getUserHomePath(): string {
  return path.resolve(process.env["USERPROFILE"] ?? process.env["HOME"] ?? os.homedir());
}

function isUserHomeDirectory(dirPath: string): boolean {
  return normalizePath(path.resolve(dirPath)) === normalizePath(getUserHomePath());
}

function parseWorkspaceList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      return [];
    }
  }

  const separator = trimmed.includes(path.delimiter) ? path.delimiter : ";";
  return trimmed
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Workspace folders que o Cursor injeta no processo MCP.
 * @see WORKSPACE_FOLDER_PATHS (Cursor forum / docs)
 */
export function getCursorWorkspaceFolders(): string[] {
  const candidates = [
    process.env["WORKSPACE_FOLDER_PATHS"],
    process.env["WORKSPACE_FOLDERS"],
    process.env["CURSOR_WORKSPACE"],
    process.env["VSCODE_CWD"],
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) {
      continue;
    }
    const folders = parseWorkspaceList(raw);
    if (folders.length > 0) {
      return folders.map((folder) => path.resolve(folder));
    }
    if (looksLikeFilesystemPath(raw)) {
      return [path.resolve(raw)];
    }
  }

  return [];
}

function findProjectRoot(startPath: string, maxDepth = 8): string | null {
  let current = path.resolve(startPath);

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const markers = [".git", "package.json", ".cursor"];
    if (markers.some((marker) => fs.existsSync(path.join(current, marker)))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function pickBestWorkspaceFolder(folders: string[]): string | null {
  const usable = folders.filter((folder) => fs.existsSync(folder) && !isUserHomeDirectory(folder));
  if (usable.length === 0) {
    return null;
  }

  const withProjectMarker = usable.find((folder) =>
    [".git", "package.json", ".cursor"].some((marker) =>
      fs.existsSync(path.join(folder, marker)),
    ),
  );

  return withProjectMarker ?? usable[0] ?? null;
}

/**
 * Workspace alvo para delegação e auto-launch.
 */
export function getTargetWorkspacePath(): string {
  const bridgeCwd =
    process.env["AGENT_OS_DEFAULT_CWD"] ?? process.env["BRIDGE_DEFAULT_CWD"];
  if (bridgeCwd?.trim()) {
    const resolved = path.resolve(bridgeCwd.trim());
    if (!isUserHomeDirectory(resolved)) {
      return resolved;
    }
  }

  const cursorFolder = pickBestWorkspaceFolder(getCursorWorkspaceFolders());
  if (cursorFolder) {
    return cursorFolder;
  }

  const workspaceEnv = process.env["ANTIGRAVITY_WORKSPACE"];
  if (workspaceEnv?.trim() && looksLikeFilesystemPath(workspaceEnv)) {
    const resolved = path.resolve(workspaceEnv.trim());
    if (!isUserHomeDirectory(resolved)) {
      return resolved;
    }
  }

  const cwd = process.cwd();
  if (!isUserHomeDirectory(cwd)) {
    const projectRoot = findProjectRoot(cwd);
    if (projectRoot) {
      return projectRoot;
    }
    return path.resolve(cwd);
  }

  const projectFromHomeWalk = findProjectRoot(cwd);
  if (projectFromHomeWalk && !isUserHomeDirectory(projectFromHomeWalk)) {
    return projectFromHomeWalk;
  }

  throw new Error(
    "Workspace alvo não identificado. Defina AGENT_OS_DEFAULT_CWD no mcp.json " +
      "ou abra o projeto via .cursor/mcp.json com ${workspaceFolder}.",
  );
}

export function getWorkspaceMatchHint(): string {
  const workspaceEnv = process.env["ANTIGRAVITY_WORKSPACE"];
  if (workspaceEnv?.trim() && !looksLikeFilesystemPath(workspaceEnv)) {
    return workspaceEnv.trim();
  }
  return getTargetWorkspacePath();
}

export function instanceMatchesWorkspace(
  workspacePath: string | undefined,
  workspaceId: string,
  targetPath: string,
): boolean {
  const normalizedTarget = normalizePath(targetPath);
  const targetBasename = normalizedTarget.split("/").pop() ?? normalizedTarget;

  if (workspacePath) {
    const normalizedInstance = normalizePath(workspacePath);
    return (
      normalizedInstance === normalizedTarget ||
      normalizedInstance.endsWith(`/${targetBasename}`)
    );
  }

  return workspaceId.toLowerCase().includes(targetBasename);
}

export function getWorkspaceResolutionDebug(): Record<string, unknown> {
  return {
    agentOsDefaultCwd: process.env["AGENT_OS_DEFAULT_CWD"] ?? null,
    bridgeDefaultCwd: process.env["BRIDGE_DEFAULT_CWD"] ?? null,
    cursorWorkspaceFolders: getCursorWorkspaceFolders(),
    processCwd: process.cwd(),
    resolvedTarget: (() => {
      try {
        return getTargetWorkspacePath();
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    })(),
  };
}
