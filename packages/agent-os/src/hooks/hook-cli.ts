/**
 * CLI dos Cursor Hooks do Agent OS. Comandos:
 *   node dist/hooks/hook-cli.js context        → sessionStart (injeta contexto)
 *   node dist/hooks/hook-cli.js enforce-shell  → beforeShellExecution (bloqueia deny)
 *   node dist/hooks/hook-cli.js enforce-write  → preToolUse Write/Edit/Delete (bloqueia deny)
 *
 * Lê JSON no stdin, escreve JSON no stdout. Fail-open: em erro interno,
 * permite a ação (use failClosed no hooks.json para inverter).
 */
import { resolveHookEnv } from "./hook-env.js";
import {
  buildSessionContext,
  enforceShell,
  enforceWrite,
  resolveWorkspaceRoot,
  type HookInput,
} from "./hook-handlers.js";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

function parseInput(raw: string): HookInput {
  try {
    return JSON.parse(raw) as HookInput;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "";
  resolveHookEnv();

  const input = parseInput(await readStdin());

  let output: Record<string, unknown>;
  switch (command) {
    case "context":
      output = await buildSessionContext(resolveWorkspaceRoot(input));
      break;
    case "enforce-shell":
      output = await enforceShell(input);
      break;
    case "enforce-write":
      output = await enforceWrite(input);
      break;
    default:
      output = {};
      console.error(`[agent-os-hook] comando desconhecido: '${command}'`);
      break;
  }

  process.stdout.write(JSON.stringify(output));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[agent-os-hook] erro: ${message}`);
  // Fail-open: JSON vazio permite a ação (failClosed inverte no hooks.json)
  process.stdout.write("{}");
  process.exit(0);
});
