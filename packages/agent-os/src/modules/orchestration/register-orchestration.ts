import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBridgeTools } from "./tools/bridge.js";
import { registerJobTools } from "./tools/jobs.js";
import { registerObservabilityTools } from "./tools/observability.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerParallelTools } from "./tools/parallel.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerWebhookTools } from "./tools/webhooks.js";

export function registerOrchestrationTools(server: McpServer): void {
  registerBridgeTools(server);
  registerJobTools(server);
  registerParallelTools(server);
  registerSessionTools(server);
  registerObservabilityTools(server);
  registerPipelineTools(server);
  registerWebhookTools(server);
}
