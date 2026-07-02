import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { findCopilotCli, isWindowsScript } from "../../client/copilot-cli.js";
import { getTargetWorkspacePath } from "../../client/workspace.js";
import { getCopilotDefaultTimeoutMs, isCopilotLightMode } from "./config.js";
import { parseCopilotStdout } from "./parser.js";
import {
  DEFAULT_COPILOT_MODEL,
  type DelegateToCopilotInput,
  type DelegateToCopilotResult,
} from "./types.js";

interface CopilotRunOptions {
  prompt: string;
  workspacePath: string;
  model: string;
  timeoutMs: number;
  readTools: boolean;
  writeTools: boolean;
  sessionId?: string;
  onChunk?: (delta: string) => void | Promise<void>;
}

function buildCopilotArgs(options: CopilotRunOptions): { args: string[]; useJson: boolean } {
  const useJson = true;
  const args = [
    "-p",
    options.prompt,
    "-s",
    "--no-ask-user",
    "--model",
    options.model,
    "--output-format",
    "json",
  ];

  if (options.sessionId) {
    args.push("--session-id", options.sessionId);
    args.push("--resume", options.sessionId);
  }

  if (isCopilotLightMode()) {
    args.push("--reasoning-effort", "low");
  }

  if (options.writeTools) {
    args.push("--allow-all-tools", "--allow-all-paths");
  } else if (options.readTools) {
    args.push("--allow-tool=read", "--allow-tool=search", "--allow-tool=grep");
  }

  return { args, useJson };
}

function runCopilot(
  options: CopilotRunOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number | null; useJson: boolean }> {
  const cli = findCopilotCli();
  if (!cli) {
    throw new Error(
      "GitHub Copilot CLI não encontrado. Verifique se está instalado e no PATH ou definido na variável BRIDGE_COPILOT_CLI.",
    );
  }

  const { command } = cli;
  const { args, useJson } = buildCopilotArgs(options);
  const useCmdWrapper = isWindowsScript(command);

  return new Promise((resolve, reject) => {
    const child = useCmdWrapper
      ? spawn("cmd.exe", ["/c", command, ...args], {
          windowsHide: true,
          env: process.env,
          cwd: options.workspacePath,
        })
      : spawn(command, args, {
          windowsHide: true,
          env: process.env,
          cwd: options.workspacePath,
        });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (options.onChunk && text) {
        void options.onChunk(text);
      }
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
        reject(new Error(`Copilot CLI excedeu timeout de ${options.timeoutMs}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode, useJson });
    });
  });
}

function resolveToolFlags(input: DelegateToCopilotInput): {
  readTools: boolean;
  writeTools: boolean;
} {
  if (input.writeTools === true || input.agenticMode === true) {
    return { readTools: true, writeTools: true };
  }
  if (input.readTools === true) {
    return { readTools: true, writeTools: false };
  }
  if (isCopilotLightMode()) {
    return { readTools: false, writeTools: false };
  }
  return { readTools: false, writeTools: input.agenticMode ?? false };
}

export async function delegateToCopilot(
  input: DelegateToCopilotInput,
): Promise<DelegateToCopilotResult> {
  const workspacePath = input.workspacePath ?? getTargetWorkspacePath();
  const model = input.model ?? DEFAULT_COPILOT_MODEL;
  const timeoutMs = input.timeoutMs ?? getCopilotDefaultTimeoutMs();
  const toolFlags = resolveToolFlags(input);

  if (!fs.existsSync(workspacePath)) {
    throw new Error(`Workspace do Copilot não existe: ${workspacePath}`);
  }

  const { stdout, stderr, exitCode, useJson } = await runCopilot({
    prompt: input.prompt,
    workspacePath,
    model,
    timeoutMs,
    readTools: toolFlags.readTools,
    writeTools: toolFlags.writeTools,
    sessionId: input.sessionId,
    onChunk: input.onChunk,
  });

  if (exitCode !== 0 && !stdout.trim()) {
    throw new Error(
      stderr.trim() || `Copilot CLI falhou com exit code ${exitCode ?? "unknown"}`,
    );
  }

  const parsed = parseCopilotStdout(stdout, useJson);

  return {
    response: parsed.response || stderr.trim(),
    sessionId: parsed.sessionId ?? input.sessionId,
    model: parsed.model ?? model,
    exitCode: exitCode ?? undefined,
    usageProfile: isCopilotLightMode() ? "light" : "full",
  };
}

export function getCopilotCliPath(): string | null {
  return findCopilotCli()?.command ?? null;
}
