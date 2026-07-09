import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";
import { getJobChunks, getJobWithEvents } from "../features/jobs/job-store.js";
import { isSupabaseConfigured } from "../features/jobs/supabase-client.js";
import { recordAllProviderHealth } from "../features/observability/health-recorder.js";
import { listHealthSnapshots } from "../features/observability/health-store.js";
import { describeTool, WORKSPACE_PATH_DESC } from "./tool-docs.js";

function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não configurado.");
  }
}

type ObservabilityArgs = {
  action: "chunks" | "health_history" | "record_health";
  job_id?: string;
  since_seq: number;
  limit: number;
  provider?: "antigravity" | "cursor" | "copilot";
  all_workspaces: boolean;
  workspace_path?: string;
};

async function handleObservability(args: ObservabilityArgs) {
  requireSupabase();

  if (args.action === "chunks") {
    if (!args.job_id) {
      return { ...jsonContent({ success: false, message: "action=chunks exige job_id" }), isError: true };
    }
    const snapshot = await getJobWithEvents(args.job_id);
    if (!snapshot) {
      return { ...jsonContent({ success: false, message: "Job não encontrado" }), isError: true };
    }
    const chunks = await getJobChunks(args.job_id, args.since_seq, args.limit);
    const assembled = chunks.map((c) => c.text).join("");
    return jsonContent({
      success: true,
      jobId: args.job_id,
      status: snapshot.job.status,
      chunkCount: chunks.length,
      sinceSeq: args.since_seq,
      assembledPreview: assembled.slice(0, 500),
      chunks,
    });
  }

  if (args.action === "health_history") {
    const snapshots = await listHealthSnapshots({
      workspace: args.all_workspaces ? undefined : resolveWorkspacePath(args.workspace_path),
      provider: args.provider,
      limit: args.limit,
    });
    return jsonContent({ success: true, count: snapshots.length, snapshots });
  }

  const snapshots = await recordAllProviderHealth(resolveWorkspacePath(args.workspace_path));
  return jsonContent({ success: true, snapshots });
}

export function registerObservabilityTools(server: McpServer): void {
  server.tool(
    "job_observability",
    describeTool("job_observability"),
    {
      action: z
        .enum(["chunks", "health_history", "record_health"])
        .describe("chunks = stream de job async; health_history = snapshots; record_health = probe agora"),
      job_id: z.string().uuid().optional(),
      since_seq: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(500).default(100),
      provider: z.enum(["antigravity", "cursor", "copilot"]).optional(),
      all_workspaces: z.boolean().default(false),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async (args) => {
      try {
        return await handleObservability(args);
      } catch (error) {
        return {
          ...jsonContent({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );
}
