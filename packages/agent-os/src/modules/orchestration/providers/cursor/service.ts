import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { killProcessTree } from "@mcps/shared";
import { findCursorAgentCli, isWindowsScript } from "../../client/cursor-cli.js";
import { getTargetWorkspacePath } from "../../client/workspace.js";
import {
  DEFAULT_CURSOR_MODEL,
  type DelegateToCursorInput,
  type DelegateToCursorResult,
} from "./types.js";

interface CursorAgentJsonOutput {
  result?: string;
  session_id?: string;
  sessionId?: string;
  model?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 180_000;

function resolveCursorInvocation(): { command: string; argsPrefix: string[] } {
  const cli = findCursorAgentCli();
  if (!cli) {
    throw new Error(
      "Cursor Agent CLI não encontrado. Instale com: irm 'https://cursor.com/install?win32=true' | iex",
    );
  }

  const versionRoot = path.join(
    process.env["LOCALAPPDATA"] ?? "",
    "cursor-agent",
    "versions",
  );

  if (fs.existsSync(versionRoot)) {
    const versionDirs = fs
      .readdirSync(versionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionRoot, entry.name))
      .sort((a, b) => b.localeCompare(a));

    for (const dir of versionDirs) {
      const nodeExe = path.join(dir, "node.exe");
      const indexJs = path.join(dir, "index.js");
      if (fs.existsSync(nodeExe) && fs.existsSync(indexJs)) {
        return { command: nodeExe, argsPrefix: [indexJs] };
      }
    }
  }

  return { command: cli.command, argsPrefix: [] };
}

function parseCursorOutput(stdout: string): DelegateToCursorResult {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { response: "" };
  }

  try {
    const parsed = JSON.parse(trimmed) as CursorAgentJsonOutput;
    return {
      response: parsed.result ?? trimmed,
      sessionId: parsed.session_id ?? parsed.sessionId,
      model: parsed.model,
    };
  } catch {
    return { response: trimmed };
  }
}

function runCursorAgent(
  prompt: string,
  workspacePath: string,
  model: string,
  timeoutMs: number,
  onChunk?: (delta: string) => void | Promise<void>,
  signal?: AbortSignal,
  resumeSessionId?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { command, argsPrefix } = resolveCursorInvocation();
  const args = [
    ...argsPrefix,
    "-p",
    "--trust",
    "--force",
    "--output-format",
    "json",
    "--workspace",
    workspacePath,
    "--model",
    model,
    ...(resumeSessionId ? ["--resume", resumeSessionId] : []),
    prompt,
  ];

  const useCmdWrapper = isWindowsScript(command);

  return new Promise((resolve, reject) => {
    const child = useCmdWrapper
      ? spawn("cmd.exe", ["/c", command, ...args], {
          windowsHide: true,
          env: process.env,
        })
      : spawn(command, args, {
          windowsHide: true,
          env: process.env,
        });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let aborted = false;

    // taskkill /t mata a árvore inteira — child.kill() só mataria o cmd.exe
    // wrapper no Windows, deixando o agente real rodando órfão.
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, timeoutMs);

    const onAbort = (): void => {
      aborted = true;
      killProcessTree(child.pid);
    };
    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (onChunk && text) {
        void onChunk(text);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (aborted) {
        reject(new Error("Cursor Agent cancelado (abort)"));
        return;
      }
      if (timedOut) {
        reject(new Error(`Cursor Agent excedeu timeout de ${timeoutMs}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

export async function delegateToCursor(
  input: DelegateToCursorInput,
): Promise<DelegateToCursorResult> {
  const workspacePath = input.workspacePath ?? getTargetWorkspacePath();
  const model = input.model ?? DEFAULT_CURSOR_MODEL;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!fs.existsSync(workspacePath)) {
    throw new Error(`Workspace do Cursor não existe: ${workspacePath}`);
  }

  const { stdout, stderr, exitCode } = await runCursorAgent(
    input.prompt,
    workspacePath,
    model,
    timeoutMs,
    input.onChunk,
    input.signal,
    input.resumeSessionId,
  );

  if (exitCode !== 0 && !stdout.trim()) {
    throw new Error(
      stderr.trim() || `Cursor Agent falhou com exit code ${exitCode ?? "unknown"}`,
    );
  }

  const parsed = parseCursorOutput(stdout);
  return {
    ...parsed,
    model: parsed.model ?? model,
    exitCode: exitCode ?? undefined,
  };
}

export function getCursorAgentPath(): string | null {
  return findCursorAgentCli()?.command ?? null;
}
