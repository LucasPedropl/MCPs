import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerHubTools } from "./tools/hub-tools.js";
import {
  ensureKeepAliveRegistered,
  startKeepAliveScheduler,
} from "./features/projects/services/keepalive-service.js";

import { HUB_INSTRUCTIONS } from "./tools/hub-instructions.js";

export function createHubServer(): McpServer {
  const server = new McpServer(
    {
      name: "supabase-mcp-hub",
      version: "0.1.0",
    },
    {
      instructions: HUB_INSTRUCTIONS,
    },
  );

  registerHubTools(server);
  return server;
}

export async function startHubServer(): Promise<void> {
  await ensureKeepAliveRegistered();
  startKeepAliveScheduler();

  const server = createHubServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
