import { startMcpEngine } from "./services/engine-service.js";
import { startSseGateway } from "./gateway/sse-server.js";

/** CLI entrypoint for stdio MCP server or SSE gateway. */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  let serverId: string | undefined;
  const idIndex = argv.indexOf("--serverId");
  if (idIndex !== -1 && argv[idIndex + 1]) {
    serverId = argv[idIndex + 1];
  }
  if (!serverId) {
    serverId = process.env["TARGET_SERVER_ID"];
  }

  const isSseMode = argv.includes("--sse") || argv.includes("--gateway");

  if (!isSseMode && !serverId) {
    console.error("ERRO: --serverId <UUID> ou TARGET_SERVER_ID é obrigatório no modo stdio.");
    process.exit(1);
  }

  if (isSseMode) {
    await startSseGateway();
    return;
  }

  await startMcpEngine(serverId!);
}
