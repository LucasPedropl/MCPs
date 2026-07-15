import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { killProcessTree } from "@mcps/shared";

export interface GateResult {
  name: string;
  success: boolean;
  output: string;
}

export interface QualityGateReport {
  success: boolean;
  results: GateResult[];
}

const DEFAULT_COMMAND_TIMEOUT_MS = 600_000;

function getCommandTimeoutMs(): number {
  const raw = process.env["AGENT_OS_GATE_TIMEOUT_MS"];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COMMAND_TIMEOUT_MS;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = getCommandTimeoutMs(),
): Promise<GateResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    let output = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        name: `${command} ${args.join(" ")}`,
        success: false,
        output: `spawn falhou: ${error.message}`,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        name: `${command} ${args.join(" ")}`,
        success: !timedOut && code === 0,
        output: timedOut
          ? `TIMEOUT após ${timeoutMs}ms (processo finalizado)\n${output.slice(-3500)}`
          : output.slice(-4000),
      });
    });
  });
}

function readPackageScripts(workspacePath: string): Record<string, string> {
  const pkgPath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return {};
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  return pkg.scripts ?? {};
}

export async function runQualityGates(workspacePath: string): Promise<QualityGateReport> {
  const scripts = readPackageScripts(workspacePath);
  const candidates: Array<[string, string[]]> = [];

  if (scripts["typecheck"]) {
    candidates.push(["npm", ["run", "typecheck"]]);
  }
  if (scripts["lint"]) {
    candidates.push(["npm", ["run", "lint"]]);
  }
  if (scripts["build"]) {
    candidates.push(["npm", ["run", "build"]]);
  }
  if (scripts["test"]) {
    candidates.push(["npm", ["run", "test"]]);
  }

  if (candidates.length === 0) {
    return {
      success: true,
      results: [
        {
          name: "no-scripts",
          success: true,
          output: "Nenhum script de quality gate encontrado no package.json.",
        },
      ],
    };
  }

  const results: GateResult[] = [];
  for (const [command, args] of candidates) {
    results.push(await runCommand(command, args, workspacePath));
  }

  return {
    success: results.every((result) => result.success),
    results,
  };
}

export async function summarizeDiff(workspacePath: string): Promise<string> {
  const status = await runCommand("git", ["status", "--short"], workspacePath);
  const diffStat = await runCommand("git", ["diff", "--stat"], workspacePath);

  return [
    "Git status:",
    status.output || "(clean)",
    "",
    "Diff stat:",
    diffStat.output || "(sem diff)",
  ].join("\n");
}

export interface RollbackResult {
  performed: boolean;
  changes: string;
  message: string;
  recoveryHint?: string;
}

/**
 * Reverte alterações locais de forma RECUPERÁVEL: guarda tudo em um git stash
 * (incluindo untracked) em vez de reset --hard + clean. Exige confirm=true;
 * sem confirmação retorna apenas o preview do que seria revertido.
 */
export async function rollbackTask(
  workspacePath: string,
  confirm = false,
): Promise<RollbackResult> {
  const status = await runCommand("git", ["status", "--short"], workspacePath, 60_000);
  const changes = status.output.trim();

  if (!changes) {
    return {
      performed: false,
      changes: "",
      message: "Nada para reverter: working tree limpo.",
    };
  }

  if (!confirm) {
    return {
      performed: false,
      changes,
      message:
        "Rollback NÃO executado. Estas mudanças seriam revertidas — confirme com confirm=true.",
    };
  }

  const stashLabel = `agent-os rollback ${new Date().toISOString()}`;
  const stash = await runCommand(
    "git",
    ["stash", "push", "--include-untracked", "-m", JSON.stringify(stashLabel)],
    workspacePath,
    60_000,
  );

  if (!stash.success) {
    return {
      performed: false,
      changes,
      message: `Rollback falhou ao criar stash: ${stash.output.trim()}`,
    };
  }

  return {
    performed: true,
    changes,
    message: `Rollback concluído via git stash ("${stashLabel}").`,
    recoveryHint: "Para desfazer o rollback: git stash pop. Para descartar de vez: git stash drop.",
  };
}

export async function runAutofixLoop(input: {
  workspacePath: string;
  delegateFix: (errorOutput: string) => Promise<void>;
  maxIterations?: number;
}): Promise<QualityGateReport> {
  const max = input.maxIterations ?? 3;

  for (let iteration = 0; iteration < max; iteration += 1) {
    const report = await runQualityGates(input.workspacePath);
    if (report.success) {
      return report;
    }

    const failed = report.results
      .filter((result) => !result.success)
      .map((result) => result.output)
      .join("\n\n");

    await input.delegateFix(failed);
  }

  return runQualityGates(input.workspacePath);
}
