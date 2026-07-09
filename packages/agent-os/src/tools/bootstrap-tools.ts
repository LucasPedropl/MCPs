import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "@mcps/shared";
import { bootstrapWorkspace } from "../modules/bootstrap/bootstrap-service.js";
import { describeAgentTool } from "./tool-docs.js";

export function registerBootstrapTools(server: McpServer): void {
  server.registerTool(
    "bootstrap_project",
    {
      description: describeAgentTool("bootstrap_project"),
      inputSchema: {
        workspace_path: z.string(),
      },
    },
    async (args) => {
      const profile = await bootstrapWorkspace(args.workspace_path);
      return jsonText(profile);
    },
  );
}
