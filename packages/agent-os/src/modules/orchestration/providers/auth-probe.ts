import { spawn } from "node:child_process";
import { findCopilotCli, isWindowsScript } from "../client/copilot-cli.js";
import { findCursorAgentCli, isWindowsScript as isCursorWindowsScript } from "../client/cursor-cli.js";

export interface AuthProbeResult {
  authenticated: boolean;
  detail: string;
}

function probeCli(
  command: string,
  args: string[],
  useCmdWrapper: boolean,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = useCmdWrapper
      ? spawn("cmd.exe", ["/c", command, ...args], { windowsHide: true, env: process.env })
      : spawn(command, args, { windowsHide: true, env: process.env });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

/** Verifica se Cursor Agent CLI está autenticado. */
export async function probeCursorAuth(): Promise<AuthProbeResult> {
  const cli = findCursorAgentCli();
  if (!cli) {
    return { authenticated: false, detail: "CLI não encontrado" };
  }

  const { stderr, exitCode } = await probeCli(
    cli.command,
    ["-p", "ping", "--output-format", "json"],
    isCursorWindowsScript(cli.command),
    12_000,
  );

  const combined = stderr.toLowerCase();
  if (combined.includes("authentication required") || combined.includes("not logged in")) {
    return {
      authenticated: false,
      detail: "Não autenticado — execute `agent login` ou defina CURSOR_API_KEY",
    };
  }

  if (exitCode !== 0) {
    return { authenticated: false, detail: stderr.trim() || `exit ${exitCode}` };
  }

  return { authenticated: true, detail: "Autenticado" };
}

/** Verifica se Copilot CLI está autenticado. */
export async function probeCopilotAuth(): Promise<AuthProbeResult> {
  const cli = findCopilotCli();
  if (!cli) {
    return { authenticated: false, detail: "CLI não encontrado" };
  }

  const hasToken =
    Boolean(process.env["COPILOT_GITHUB_TOKEN"]) ||
    Boolean(process.env["GH_TOKEN"]) ||
    Boolean(process.env["GITHUB_TOKEN"]);

  const { stdout, stderr, exitCode } = await probeCli(
    cli.command,
    ["-p", "ping", "-s", "--no-ask-user", "--model", "auto"],
    isWindowsScript(cli.command),
    20_000,
  );

  const combined = `${stdout}\n${stderr}`.toLowerCase();
  if (
    combined.includes("not logged in") ||
    combined.includes("authentication required") ||
    combined.includes("please run 'copilot login'")
  ) {
    return {
      authenticated: false,
      detail: hasToken
        ? "Token env presente mas auth falhou — verifique escopo"
        : "Não autenticado — execute `copilot login`",
    };
  }

  if (exitCode !== 0 && !stdout.trim()) {
    return { authenticated: false, detail: stderr.trim() || `exit ${exitCode}` };
  }

  const profile = process.env["BRIDGE_COPILOT_PROFILE"]?.trim().toLowerCase() ?? "light";
  return {
    authenticated: true,
    detail: `Autenticado (perfil: ${profile === "full" || profile === "pro" ? "full" : "light"})`,
  };
}
