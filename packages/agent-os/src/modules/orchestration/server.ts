import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBridgeTools } from "./tools/bridge.js";
import { registerJobTools } from "./tools/jobs.js";
import { registerObservabilityTools } from "./tools/observability.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerParallelTools } from "./tools/parallel.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerUsageGuideTool } from "./tools/usage-guide.js";
import { BRIDGE_INSTRUCTIONS } from "./tools/tool-docs.js";
import { recoverOrphanJobs } from "./features/jobs/job-runner.js";
import { startRealtimeWorker } from "./features/jobs/realtime-worker.js";
import { enableHotReload } from "./dev/hot-reload.js";

export function createBridgeServer(): McpServer {
  const server = new McpServer(
    {
      name: "mcpcomunication",
      version: "1.0.1",
    },
    {
      instructions: BRIDGE_INSTRUCTIONS,
    },
  );

  registerBridgeTools(server);
  registerJobTools(server);
  registerParallelTools(server);
  registerSessionTools(server);
  registerObservabilityTools(server);
  registerPipelineTools(server);
  registerWebhookTools(server);
  registerUsageGuideTool(server);
  return server;
}

export async function startBridgeServer(): Promise<void> {
  void recoverOrphanJobs().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[job-runner] orphan recovery falhou: ${message}`);
  });

  if (process.env["BRIDGE_REALTIME_WORKER"] === "1") {
    startRealtimeWorker();
  }

  const server = createBridgeServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  enableHotReload();
}
