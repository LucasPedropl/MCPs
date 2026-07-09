import { execSync } from "node:child_process";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { findAntigravityLauncher } from "../../client/launcher.js";

export interface HeadlessAntigravityInput {
  prompt: string;
  workspacePath: string;
  timeoutMs?: number;
}

export interface HeadlessAntigravityResult {
  response: string;
  exitCode: number | null;
  usedHeadless: boolean;
}

function resolveHeadlessBinary(): string | null {
  const env = process.env["BRIDGE_ANTIGRAVITY_HEADLESS_CLI"]?.trim();
  if (env && fs.existsSync(env)) {
    return env;
  }

  try {
    if (process.platform === "win32") {
      const found = execSync("where agy", { encoding: "utf8", windowsHide: true })
        .trim()
        .split(/\r?\n/)[0]
        ?.trim();
      if (found && fs.existsSync(found)) {
        return found;
      }
    }
  } catch {
    // where falhou
  }

  const launcher = findAntigravityLauncher();
  if (!launcher) {
    return null;
  }

  if (/agy\.exe|agy$/i.test(launcher)) {
    return launcher;
  }

  const agyCandidate = launcher.replace(/antigravity-ide\.cmd/i, "agy.exe");
  if (fs.existsSync(agyCandidate)) {
    return agyCandidate;
  }

  return null;
}

/** Headless ativo quando parallel agentic ou flag explícita. */
export function isHeadlessAntigravityEnabled(): boolean {
  const parallel = process.env["BRIDGE_ANTIGRAVITY_PARALLEL"];
  if (parallel === undefined || parallel === "" || !["0", "false", "no", "off"].includes(parallel.toLowerCase())) {
    return true;
  }
  const raw = process.env["BRIDGE_ANTIGRAVITY_HEADLESS"];
  if (raw === undefined || raw === "") {
    return false;
  }
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

export async function delegateToHeadlessAntigravity(
  input: HeadlessAntigravityInput,
): Promise<HeadlessAntigravityResult> {
  const binary = resolveHeadlessBinary();
  if (!binary) {
    throw new Error(
      "CLI headless agy não encontrado. Defina BRIDGE_ANTIGRAVITY_HEADLESS_CLI ou instale agy no PATH.",
    );
  }

  const timeoutMs = input.timeoutMs ?? 180_000;
  const args = ["-p", input.prompt, "--trust"];
  const useCmd = binary.toLowerCase().endsWith(".cmd");

  return new Promise((resolve, reject) => {
    const child = useCmd
      ? spawn("cmd.exe", ["/c", binary, ...args], {
          cwd: input.workspacePath,
          windowsHide: true,
          env: process.env,
        })
      : spawn(binary, args, {
          cwd: input.workspacePath,
          windowsHide: true,
          env: process.env,
        });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Headless agy excedeu timeout de ${timeoutMs}ms`));
        return;
      }
      resolve({
        response: stdout.trim() || stderr.trim(),
        exitCode,
        usedHeadless: true,
      });
    });
  });
}

export function isHeadlessAvailable(): boolean {
  return resolveHeadlessBinary() !== null;
}
