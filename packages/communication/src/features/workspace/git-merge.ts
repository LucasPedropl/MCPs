import * as fs from "node:fs";
import * as path from "node:path";
import type { DelegationWorkspace } from "./git-worktree.js";
import { releaseDelegationWorkspace } from "./git-worktree.js";
import {
  abortMergeIfInProgress,
  branchCommitsAhead,
  hasWorkingTreeChanges,
  runGit,
  runGitAllowFail,
} from "./git-utils.js";

export type MergeConflictStrategy = "theirs" | "ours" | "smart";
export type MergeResolution = "clean" | "strategy" | "auto" | "skipped" | "failed";

export interface MergeDelegationResult {
  merged: boolean;
  targetBranch: string;
  sourceBranch: string;
  commit?: string;
  conflicts?: string[];
  resolution: MergeResolution;
  error?: string;
}

/** Merge automático habilitado por padrão (CI-style, sem aprovação manual). */
export function isAutoMergeEnabled(): boolean {
  const raw = process.env["BRIDGE_AUTO_MERGE"];
  if (raw === undefined || raw === "") {
    return true;
  }
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

export function getMergeConflictStrategy(): MergeConflictStrategy {
  const raw = (process.env["BRIDGE_MERGE_STRATEGY"] ?? "smart").toLowerCase();
  if (raw === "theirs" || raw === "ours") {
    return raw;
  }
  return "smart";
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

const CONFLICT_START = /^<<<<<<< /;
const CONFLICT_SEP = /^=======\s*$/;
const CONFLICT_END = /^>>>>>>> /;

/** Resolve marcadores de conflito preferindo a versão incoming (delegação). */
function resolveConflictMarkers(content: string, strategy: MergeConflictStrategy): string {
  const lines = content.split("\n");
  const resolved: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!CONFLICT_START.test(line)) {
      resolved.push(line);
      index += 1;
      continue;
    }

    index += 1;
    const ours: string[] = [];
    while (index < lines.length && !CONFLICT_SEP.test(lines[index] ?? "")) {
      ours.push(lines[index] ?? "");
      index += 1;
    }
    index += 1;

    const theirs: string[] = [];
    while (index < lines.length && !CONFLICT_END.test(lines[index] ?? "")) {
      theirs.push(lines[index] ?? "");
      index += 1;
    }
    index += 1;

    const pickTheirs = strategy === "theirs" || strategy === "smart";
    const pickOurs = strategy === "ours";

    if (pickTheirs && theirs.length > 0) {
      resolved.push(...theirs);
    } else if (pickOurs && ours.length > 0) {
      resolved.push(...ours);
    } else if (theirs.length > 0) {
      resolved.push(...theirs);
    } else if (ours.length > 0) {
      resolved.push(...ours);
    }
  }

  return resolved.join("\n");
}

function resolveConflictsInWorkspace(
  basePath: string,
  strategy: MergeConflictStrategy,
): string[] {
  const conflictFiles = listConflictFiles(basePath);
  for (const file of conflictFiles) {
    const fullPath = path.join(basePath, file);
    const content = fs.readFileSync(fullPath, "utf8");
    fs.writeFileSync(fullPath, resolveConflictMarkers(content, strategy), "utf8");
    runGit(basePath, ["add", file]);
  }
  return conflictFiles;
}

function deleteDelegationBranch(basePath: string, branch: string): void {
  runGitAllowFail(basePath, ["branch", "-D", branch]);
}

function attemptMerge(
  basePath: string,
  sourceBranch: string,
  strategy: MergeConflictStrategy,
): { ok: boolean; resolution: MergeResolution; conflicts: string[] } {
  abortMergeIfInProgress(basePath);

  let merge = runGitAllowFail(basePath, ["merge", sourceBranch, "--no-edit"]);
  if (merge.ok) {
    return { ok: true, resolution: "clean", conflicts: [] };
  }

  if (strategy === "smart") {
    abortMergeIfInProgress(basePath);
    merge = runGitAllowFail(basePath, [
      "merge",
      sourceBranch,
      "--no-edit",
      "-X",
      "theirs",
    ]);
    if (merge.ok) {
      return { ok: true, resolution: "strategy", conflicts: [] };
    }
  } else if (strategy === "theirs" || strategy === "ours") {
    abortMergeIfInProgress(basePath);
    const prefer = strategy === "theirs" ? "theirs" : "ours";
    merge = runGitAllowFail(basePath, [
      "merge",
      sourceBranch,
      "--no-edit",
      "-X",
      prefer,
    ]);
    if (merge.ok) {
      return { ok: true, resolution: "strategy", conflicts: [] };
    }
  }

  const conflicts = listConflictFiles(basePath);
  if (conflicts.length === 0) {
    return { ok: false, resolution: "failed", conflicts: [] };
  }

  const resolvedFiles = resolveConflictsInWorkspace(basePath, strategy);
  const commit = runGitAllowFail(basePath, ["commit", "--no-edit"]);
  if (!commit.ok) {
    abortMergeIfInProgress(basePath);
    return { ok: false, resolution: "failed", conflicts: resolvedFiles };
  }

  return { ok: true, resolution: "auto", conflicts: resolvedFiles };
}

/** Commita, faz merge na branch base, remove worktree e apaga branch de delegação. */
export function finalizeDelegationWorkspace(
  workspace: DelegationWorkspace,
): MergeDelegationResult {
  const basePath = workspace.basePath;
  const targetBranch = workspace.baseBranch;
  const sourceBranch = workspace.branch;

  if (!workspace.isolated) {
    return {
      merged: false,
      targetBranch,
      sourceBranch,
      resolution: "skipped",
    };
  }

  const worktreePath = workspace.worktreePath ?? workspace.path;

  try {
    commitWorktreeChanges(worktreePath, sourceBranch);

    const ahead = branchCommitsAhead(basePath, sourceBranch, targetBranch);
    const dirty = hasWorkingTreeChanges(worktreePath);

    releaseDelegationWorkspace(workspace);

    if (ahead === 0 && !dirty) {
      deleteDelegationBranch(basePath, sourceBranch);
      return {
        merged: false,
        targetBranch,
        sourceBranch,
        resolution: "skipped",
      };
    }

    runGit(basePath, ["checkout", targetBranch]);

    const mergeAttempt = attemptMerge(basePath, sourceBranch, getMergeConflictStrategy());
    if (!mergeAttempt.ok) {
      return {
        merged: false,
        targetBranch,
        sourceBranch,
        conflicts: mergeAttempt.conflicts,
        resolution: "failed",
        error: "Merge automático falhou após resolução de conflitos.",
      };
    }

    const commit = runGitAllowFail(basePath, ["rev-parse", "HEAD"]).stdout;
    deleteDelegationBranch(basePath, sourceBranch);

    return {
      merged: true,
      targetBranch,
      sourceBranch,
      commit: commit || undefined,
      conflicts: mergeAttempt.conflicts.length > 0 ? mergeAttempt.conflicts : undefined,
      resolution: mergeAttempt.resolution,
    };
  } catch (error) {
    abortMergeIfInProgress(basePath);
    return {
      merged: false,
      targetBranch,
      sourceBranch,
      resolution: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
