import { spawn } from "node:child_process";
import { findCopilotCli, isWindowsScript } from "../../client/copilot-cli.js";
import { KNOWN_COPILOT_MODELS } from "./types.js";

export interface ProbedModel {
  id: string;
  label: string;
  available: boolean;
}

function runHelp(command: string, useCmd: boolean): Promise<string> {
  return new Promise((resolve) => {
    const child = useCmd
      ? spawn("cmd.exe", ["/c", command, "--help"], { windowsHide: true, env: process.env })
      : spawn(command, ["--help"], { windowsHide: true, env: process.env });
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

function parseModelsFromHelp(text: string): string[] {
  const found = new Set<string>();
  const modelPattern = /\b(gpt-[\w.-]+|claude-[\w.-]+|gemini-[\w.-]+|auto)\b/gi;
  for (const match of text.matchAll(modelPattern)) {
    found.add(match[0].toLowerCase());
  }
  return [...found];
}

/** Lista modelos Copilot via --help + lista conhecida. */
export async function probeCopilotModels(): Promise<ProbedModel[]> {
  const cli = findCopilotCli();
  if (!cli) {
    return KNOWN_COPILOT_MODELS.map((id) => ({ id, label: id, available: false }));
  }

  const help = await runHelp(cli.command, isWindowsScript(cli.command));
  const fromHelp = parseModelsFromHelp(help);
  const merged = new Set([...KNOWN_COPILOT_MODELS, ...fromHelp]);

  return [...merged].map((id) => ({
    id,
    label: id,
    available: fromHelp.length === 0 || fromHelp.includes(id) || id === "auto",
  }));
}
