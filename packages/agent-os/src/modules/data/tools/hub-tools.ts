import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAccountTools,
  registerProjectTools,
  registerKeepAliveTools,
  registerProxyTools,
  registerMetaTools,
  registerSettingsTools,
} from "./hub-tools-core.js";

export function registerHubTools(server: McpServer): void {
  registerAccountTools(server);
  registerProjectTools(server);
  registerKeepAliveTools(server);
  registerSettingsTools(server);
  registerMetaTools(server);
  registerProxyTools(server);
}
