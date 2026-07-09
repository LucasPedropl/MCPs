import { spawn } from "node:child_process";
import { findCursorAgentCli, isWindowsScript } from "../../client/cursor-cli.js";
import { DEFAULT_CURSOR_MODEL, KNOWN_CURSOR_MODELS } from "./types.js";

export interface ProbedModel {
  id: string;
  label: string;
  available: boolean;
}

function runCli(args: string[], command: string, useCmd: boolean): Promise<string> {
  return new Promise((resolve) => {
    const child = useCmd
      ? spawn("cmd.exe", ["/c", command, ...args], { windowsHide: true, env: process.env })
      : spawn(command, args, { windowsHide: true, env: process.env });
    let out = "";
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.on("close", () => resolve(out));
    child.on("error", () => resolve(""));
  });
}

/** Lista modelos Cursor via `agent models` ou fallback estático. */
export async function probeCursorModels(): Promise<ProbedModel[]> {
  const cli = findCursorAgentCli();
  if (!cli) {
    return KNOWN_CURSOR_MODELS.map((id) => ({ id, label: id, available: false }));
  }

  const useCmd = isWindowsScript(cli.command);
  const raw = await runCli(["models"], cli.command, useCmd);

  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as { models?: Array<{ id?: string; name?: string }> };
      if (parsed.models?.length) {
        return parsed.models.map((m) => ({
          id: m.id ?? m.name ?? "unknown",
          label: m.name ?? m.id ?? "unknown",
          available: true,
        }));
      }
    } catch {
      const lines = raw.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length > 1) {
        return lines.map((id) => ({ id: id.trim(), label: id.trim(), available: true }));
      }
    }
  }

  return KNOWN_CURSOR_MODELS.map((id) => ({
    id,
    label: id,
    available: id === DEFAULT_CURSOR_MODEL,
  }));
}
