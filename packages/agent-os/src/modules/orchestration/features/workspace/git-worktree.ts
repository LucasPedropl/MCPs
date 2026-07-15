import * as fs from "node:fs";
import * as path from "node:path";
import { agentOsEnv } from "../../../../config/env.js";
import type { BridgeProvider } from "../../client/types.js";
import { runGit } from "./git-utils.js";

export interface DelegationWorkspace {
  path: string;
  branch: string;
  baseBranch: string;
  basePath: string;
  worktreePath?: string;
  isolated: boolean;
}

function isGitRepo(workspace: string): boolean {
  return fs.existsSync(path.join(workspace, ".git"));
}

function getCurrentBranch(workspace: string): string {
  try {
    return runGit(workspace, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    return "unknown";
  }
}

/** Isolamento por worktree habilitado por padrão em delegações agentic. */
export function isWorktreeIsolationEnabled(): boolean {
  const raw = agentOsEnv("ISOLATE_WORKSPACE");
  if (raw === undefined || raw === "") {
    return true;
  }
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

function createWorktree(baseWorkspace: string, branch: string, worktreePath: string): void {
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  if (fs.existsSync(worktreePath)) {
    return;
  }
  try {
    runGit(baseWorkspace, ["worktree", "add", "-B", branch, worktreePath]);
  } catch {
    runGit(baseWorkspace, ["worktree", "add", branch, worktreePath]);
  }
}

/** Cria worktree isolado: branch `bridge/{provider}/{id}`. */
export function prepareDelegationWorkspace(
  baseWorkspace: string,
  provider: BridgeProvider,
  holderId: string,
  agentic: boolean,
): DelegationWorkspace {
  const base = path.resolve(baseWorkspace);
  const currentBranch = getCurrentBranch(base);

  if (!agentic || !isWorktreeIsolationEnabled() || !isGitRepo(base)) {
    return {
      path: base,
      branch: currentBranch,
      baseBranch: currentBranch,
      basePath: base,
      isolated: false,
    };
  }

  const shortId = holderId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || Date.now().toString(36);
  const branch = `bridge/${provider}/${shortId}`;
  const worktreePath = path.join(base, ".bridge-worktrees", `${provider}-${shortId}`);

  createWorktree(base, branch, worktreePath);

  return {
    path: worktreePath,
    branch,
    baseBranch: currentBranch,
    basePath: base,
    worktreePath,
    isolated: true,
  };
}

/** Remove worktree após delegação (branch permanece até merge automático). */
export function releaseDelegationWorkspace(workspace: DelegationWorkspace): void {
  if (!workspace.isolated || !workspace.worktreePath) {
    return;
  }
  if (!fs.existsSync(workspace.worktreePath)) {
    return;
  }
  try {
    runGit(workspace.basePath, ["worktree", "remove", "--force", workspace.worktreePath]);
  } catch {
    // worktree pode já ter sido removido
  }
}
