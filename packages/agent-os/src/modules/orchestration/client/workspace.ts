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

  // Cursor às vezes injeta CSV (`,`); no Windows path.delimiter é `;`.
  const separator = trimmed.includes(path.delimiter)
    ? path.delimiter
    : trimmed.includes(";")
      ? ";"
      : trimmed.includes(",")
        ? ","
        : null;

  const parts = separator ? trimmed.split(separator) : [trimmed];
  return parts.map((entry) => entry.trim()).filter(Boolean);
}

/** `${workspaceFolder}` sem expandir, ou path inválido — não usar como cwd fixo. */
function isUsableDefaultCwd(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("${")) {
    return false;
  }
  if (!looksLikeFilesystemPath(trimmed)) {
    return false;
  }
  const resolved = path.resolve(trimmed);
  return !isUserHomeDirectory(resolved) && fs.existsSync(resolved);
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
 *
 * Prioridade: pastas abertas no host (Cursor) → DEFAULT_CWD (fallback) →
 * Antigravity → process.cwd. Assim `${workspaceFolder}` no mcp.json não
 * “prende” o agent-os no projeto da janela que bootou o MCP.
 */
export function getTargetWorkspacePath(): string {
  const cursorFolder = pickBestWorkspaceFolder(getCursorWorkspaceFolders());
  if (cursorFolder) {
    return cursorFolder;
  }

  const bridgeCwd =
    process.env["AGENT_OS_DEFAULT_CWD"] ?? process.env["BRIDGE_DEFAULT_CWD"];
  if (bridgeCwd && isUsableDefaultCwd(bridgeCwd)) {
    return path.resolve(bridgeCwd.trim());
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
    "Workspace alvo não identificado. Abra um projeto na IDE ou defina " +
      "AGENT_OS_DEFAULT_CWD no mcp.json (ex.: ${workspaceFolder}).",
  );
}

export function getWorkspaceMatchHint(): string {
  const workspaceEnv = process.env["ANTIGRAVITY_WORKSPACE"];
  if (workspaceEnv?.trim() && !looksLikeFilesystemPath(workspaceEnv)) {
    return workspaceEnv.trim();
  }
  return getTargetWorkspacePath();
}

/**
 * Codifica um path no formato (lossy) do workspace_id do Antigravity:
 * `c:/foo/bar` → `c_3a_foo_bar`. Comparar no espaço encoded evita o problema
 * do decode `_`→`/`, que corrompe underscores reais em nomes de pasta.
 */
function encodeWorkspacePathLikeId(targetPath: string): string {
  const normalized = normalizePath(targetPath);
  const driveMatch = normalized.match(/^([a-z]):\/(.*)$/);
  if (!driveMatch) {
    return normalized.replace(/\//g, "_");
  }
  return `${driveMatch[1]}_3a_${(driveMatch[2] ?? "").replace(/\//g, "_")}`;
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
    if (
      normalizedInstance === normalizedTarget ||
      normalizedInstance.endsWith(`/${targetBasename}`)
    ) {
      return true;
    }
    // Não retornar false ainda: o workspacePath vem de um decode lossy
    // (underscores reais viram "/") — o fallback pelo id encoded abaixo
    // ainda pode casar corretamente.
  }

  const id = workspaceId.toLowerCase();
  const encodedTarget = encodeWorkspacePathLikeId(targetPath);
  if (encodedTarget && id.endsWith(encodedTarget)) {
    return true;
  }

  return id.includes(targetBasename);
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
