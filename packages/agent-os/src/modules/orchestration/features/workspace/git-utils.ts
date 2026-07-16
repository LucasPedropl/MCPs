import { execFileSync } from "node:child_process";

export function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function runGitAllowFail(
  cwd: string,
  args: string[],
): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const err = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      ok: false,
      stdout: String(err.stdout ?? "").trim(),
      stderr: String(err.stderr ?? "").trim(),
    };
  }
}

export function hasWorkingTreeChanges(cwd: string): boolean {
  try {
    return runGit(cwd, ["status", "--porcelain"]).length > 0;
  } catch (error) {
    // false aqui pode significar "pular commit de trabalho de delegação" —
    // não deixar a falha do git passar em silêncio.
    console.error(
      `[git] status falhou em ${cwd}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

export function branchCommitsAhead(
  cwd: string,
  branch: string,
  baseBranch: string,
): number {
  try {
    const out = runGit(cwd, ["rev-list", "--count", `${baseBranch}..${branch}`]);
    const count = Number.parseInt(out, 10);
    return Number.isFinite(count) ? count : 0;
  } catch (error) {
    // 0 aqui leva o caller a tratar a branch como vazia (e apagá-la) —
    // registrar quando o valor vem de erro, não de contagem real.
    console.error(
      `[git] rev-list ${baseBranch}..${branch} falhou em ${cwd}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

export function abortMergeIfInProgress(cwd: string): void {
  try {
    runGit(cwd, ["merge", "--abort"]);
  } catch {
    // não estava em merge
  }
}
