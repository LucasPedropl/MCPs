import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "@mcps/shared";
import { assembleContext } from "../modules/context/context-assembler.js";
import {
  computeContextDiff,
  saveSnapshot,
} from "../modules/context/snapshot-store.js";
import { describeAgentTool } from "./tool-docs.js";

export function registerContextTools(server: McpServer): void {
  server.registerTool(
    "assemble_context",
    {
      description: describeAgentTool("assemble_context"),
      inputSchema: {
        intent: z.string(),
        workspace_path: z.string(),
        host: z.enum(["cursor", "antigravity", "claude_code", "unknown"]).optional(),
        token_budget: z.number().optional(),
        use_cache: z.boolean().optional(),
      },
    },
    async (args) => {
      const context = await assembleContext({
        intent: args.intent,
        workspace: args.workspace_path,
        host: args.host,
        tokenBudget: args.token_budget,
        useCache: args.use_cache,
      });

      const diff = await computeContextDiff(args.workspace_path, context);
      const snapshot = await saveSnapshot(args.workspace_path, context);

      return jsonText({
        ...context,
        snapshot: snapshot
          ? { id: snapshot.id, hash: snapshot.snapshot_hash, created_at: snapshot.created_at }
          : null,
        diff,
      });
    },
  );
}
