import * as fs from "node:fs";
import * as path from "node:path";
import { getTargetWorkspacePath, normalizePath } from "./workspace.js";

/** Resolve workspace alvo com override opcional explícito. */
export function resolveWorkspacePath(override?: string): string {
  if (override?.trim()) {
    const resolved = path.resolve(override.trim());
    if (!fs.existsSync(resolved)) {
      throw new Error(`workspace_path não existe: ${resolved}`);
    }
    return resolved;
  }
  return getTargetWorkspacePath();
}

export interface WorkspaceMatchResult {
  matched: boolean;
  targetPath: string;
  antigravityPath?: string;
  warning?: string;
}

/** Verifica se a instância Antigravity ativa corresponde ao workspace alvo. */
export function checkAntigravityWorkspaceMatch(
  targetPath: string,
  antigravityWorkspacePath?: string,
): WorkspaceMatchResult {
  const result: WorkspaceMatchResult = { matched: true, targetPath };

  if (!antigravityWorkspacePath?.trim()) {
    result.matched = false;
    result.warning =
      "Antigravity sem workspace identificado — abra o projeto correto no Antigravity ou confie no auto-launch.";
    return result;
  }

  const normalizedTarget = normalizePath(targetPath);
  const normalizedAg = normalizePath(antigravityWorkspacePath);

  if (
    normalizedTarget === normalizedAg ||
    normalizedTarget.endsWith(`/${normalizedAg.split("/").pop() ?? ""}`) ||
    normalizedAg.endsWith(`/${normalizedTarget.split("/").pop() ?? ""}`)
  ) {
    result.antigravityPath = antigravityWorkspacePath;
    return result;
  }

  result.matched = false;
  result.antigravityPath = antigravityWorkspacePath;
  result.warning =
    `Antigravity aberto em "${antigravityWorkspacePath}" mas o bridge aponta para "${targetPath}". ` +
    "Delegações agentic podem alterar o projeto errado. Abra o workspace correto ou defina workspace_path.";
  return result;
}
