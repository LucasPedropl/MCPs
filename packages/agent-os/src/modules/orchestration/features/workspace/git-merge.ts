import { agentOsEnv } from "../../../../config/env.js";
import type { DelegationWorkspace } from "./git-worktree.js";
import { releaseDelegationWorkspace } from "./git-worktree.js";
import {
  abortMergeIfInProgress,
  branchCommitsAhead,
  hasWorkingTreeChanges,
  runGit,
  runGitAllowFail,
} from "./git-utils.js";

export type MergeConflictStrategy = "manual" | "theirs" | "ours";
export type MergeResolution =
  | "clean"
  | "fast-forward"
  | "strategy"
  | "skipped"
  | "manual"
  | "failed";

export interface MergeDelegationResult {
  merged: boolean;
  targetBranch: string;
  sourceBranch: string;
  commit?: string;
  conflicts?: string[];
  resolution: MergeResolution;
  /** true quando a branch bridge/* foi preservada para merge manual. */
  branchKept?: boolean;
  manualMergeHint?: string;
  error?: string;
}

/** Merge automático DESLIGADO por padrão — a branch bridge/* fica para revisão manual. */
export function isAutoMergeEnabled(): boolean {
  const raw = agentOsEnv("AUTO_MERGE");
  if (raw === undefined || raw === "") {
    return false;
  }
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

/** Sem resolução automática de conflito por padrão; theirs/ours exigem opt-in explícito. */
export function getMergeConflictStrategy(): MergeConflictStrategy {
  const raw = (agentOsEnv("MERGE_STRATEGY") ?? "manual").toLowerCase();
  if (raw === "theirs" || raw === "ours") {
    return raw;
  }
  return "manual";
}

function commitWorktreeChanges(worktreePath: string, branch: string): boolean {
  if (!hasWorkingTreeChanges(worktreePath)) {
    return false;
  }
  runGit(worktreePath, ["add", "-A"]);
  runGit(worktreePath, [
    "commit",
    "-m",
    `bridge: auto-commit delegation on ${branch}`,
  ]);
  return true;
}

function listConflictFiles(cwd: string): string[] {
  const result = runGitAllowFail(cwd, ["diff", "--name-only", "--diff-filter=U"]);
  if (!result.ok) {
    return [];
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCurrentBranch(cwd: string): string {
  const result = runGitAllowFail(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.ok ? result.stdout : "";
}

function deleteDelegationBranch(basePath: string, branch: string): void {
  runGitAllowFail(basePath, ["branch", "-D", branch]);
}

function manualResult(
  targetBranch: string,
  sourceBranch: string,
  reason: string,
  conflicts?: string[],
): MergeDelegationResult {
  return {
    merged: false,
    targetBranch,
    sourceBranch,
    conflicts: conflicts && conflicts.length > 0 ? conflicts : undefined,
    resolution: "manual",
    branchKept: true,
    manualMergeHint: `Revise e mescle manualmente: git merge ${sourceBranch} (${reason})`,
  };
}

/**
 * Commita o trabalho da delegação na branch bridge/*, remove o worktree e
 * PRESERVA a branch para merge manual. Nunca toca na branch do usuário.
 */
export function preserveDelegationWorkspace(
  workspace: DelegationWorkspace,
): MergeDelegationResult {
  const targetBranch = workspace.baseBranch;
  const sourceBranch = workspace.branch;

  if (!workspace.isolated) {
    return { merged: false, targetBranch, sourceBranch, resolution: "skipped" };
  }

  const worktreePath = workspace.worktreePath ?? workspace.path;

  try {
    commitWorktreeChanges(worktreePath, sourceBranch);
    const ahead = branchCommitsAhead(workspace.basePath, sourceBranch, targetBranch);
    releaseDelegationWorkspace(workspace);

    if (ahead === 0) {
      deleteDelegationBranch(workspace.basePath, sourceBranch);
      return { merged: false, targetBranch, sourceBranch, resolution: "skipped" };
    }

    return manualResult(targetBranch, sourceBranch, "auto-merge desativado");
  } catch (error) {
    return {
      merged: false,
      targetBranch,
      sourceBranch,
      resolution: "failed",
      branchKept: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Commita e tenta merge SEGURO na branch base:
 * - nunca faz checkout no repositório do usuário;
 * - se a branch alvo não está em uso: apenas fast-forward via ref update;
 * - se está em uso e limpa: merge normal; conflito → aborta e preserva a branch;
 * - theirs/ours só quando configurado explicitamente.
 */
export function finalizeDelegationWorkspace(
  workspace: DelegationWorkspace,
): MergeDelegationResult {
  const basePath = workspace.basePath;
  const targetBranch = workspace.baseBranch;
  const sourceBranch = workspace.branch;

  if (!workspace.isolated) {
    return { merged: false, targetBranch, sourceBranch, resolution: "skipped" };
  }

  const worktreePath = workspace.worktreePath ?? workspace.path;

  try {
    commitWorktreeChanges(worktreePath, sourceBranch);

    const ahead = branchCommitsAhead(basePath, sourceBranch, targetBranch);

    releaseDelegationWorkspace(workspace);

    if (ahead === 0) {
      deleteDelegationBranch(basePath, sourceBranch);
      return { merged: false, targetBranch, sourceBranch, resolution: "skipped" };
    }

    const currentBranch = getCurrentBranch(basePath);

    if (currentBranch !== targetBranch) {
      // Branch alvo não está no working tree: só fast-forward via ref update.
      const ff = runGitAllowFail(basePath, [
        "fetch",
        ".",
        `${sourceBranch}:${targetBranch}`,
      ]);
      if (ff.ok) {
        const commit = runGitAllowFail(basePath, ["rev-parse", targetBranch]).stdout;
        deleteDelegationBranch(basePath, sourceBranch);
        return {
          merged: true,
          targetBranch,
          sourceBranch,
          commit: commit || undefined,
          resolution: "fast-forward",
        };
      }
      return manualResult(
        targetBranch,
        sourceBranch,
        `branch atual é ${currentBranch || "desconhecida"}; fast-forward não foi possível`,
      );
    }

    if (hasWorkingTreeChanges(basePath)) {
      return manualResult(
        targetBranch,
        sourceBranch,
        "working tree com mudanças não commitadas",
      );
    }

    const strategy = getMergeConflictStrategy();
    abortMergeIfInProgress(basePath);
    const mergeArgs = ["merge", sourceBranch, "--no-edit"];
    if (strategy === "theirs" || strategy === "ours") {
      mergeArgs.push("-X", strategy);
    }
    const merge = runGitAllowFail(basePath, mergeArgs);

    if (!merge.ok) {
      const conflicts = listConflictFiles(basePath);
      abortMergeIfInProgress(basePath);
      return manualResult(
        targetBranch,
        sourceBranch,
        "conflitos de merge",
        conflicts,
      );
    }

    const commit = runGitAllowFail(basePath, ["rev-parse", "HEAD"]).stdout;
    deleteDelegationBranch(basePath, sourceBranch);

    return {
      merged: true,
      targetBranch,
      sourceBranch,
      commit: commit || undefined,
      resolution: strategy === "manual" ? "clean" : "strategy",
    };
  } catch (error) {
    abortMergeIfInProgress(basePath);
    return {
      merged: false,
      targetBranch,
      sourceBranch,
      resolution: "failed",
      branchKept: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
