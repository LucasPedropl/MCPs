import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface GateResult {
  name: string;
  success: boolean;
  output: string;
}

export interface QualityGateReport {
  success: boolean;
  results: GateResult[];
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<GateResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: true });
    let output = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        name: `${command} ${args.join(" ")}`,
        success: code === 0,
        output: output.slice(-4000),
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

export async function rollbackTask(workspacePath: string): Promise<string> {
  await runCommand("git", ["reset", "--hard"], workspacePath);
  await runCommand("git", ["clean", "-fd"], workspacePath);
  return "Rollback concluído: git reset --hard && git clean -fd";
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
