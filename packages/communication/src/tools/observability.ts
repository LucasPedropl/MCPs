import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";import { getJobChunks, getJobWithEvents } from "../features/jobs/job-store.js";
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

export function registerObservabilityTools(server: McpServer): void {
  server.tool(
    "get_job_chunks",
    describeTool("get_job_chunks"),    {
      job_id: z.string().uuid(),
      since_seq: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ job_id, since_seq, limit }) => {
      try {
        requireSupabase();
        const snapshot = await getJobWithEvents(job_id);
        if (!snapshot) {
          return {
            ...jsonContent({ success: false, message: "Job não encontrado" }),
            isError: true,
          };
        }

        const chunks = await getJobChunks(job_id, since_seq, limit);
        const assembled = chunks.map((c) => c.text).join("");

        return jsonContent({
          success: true,
          jobId: job_id,
          status: snapshot.job.status,
          chunkCount: chunks.length,
          sinceSeq: since_seq,
          assembledPreview: assembled.slice(0, 500),
          chunks,
        });
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

  server.tool(
    "get_health_history",
    describeTool("get_health_history"),
    {
      provider: z.enum(["antigravity", "cursor", "copilot"]).optional(),
      limit: z.number().int().min(1).max(100).default(30),
      all_workspaces: z.boolean().default(false),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ provider, limit, all_workspaces, workspace_path }) => {
      try {
        requireSupabase();
        const snapshots = await listHealthSnapshots({
          workspace: all_workspaces
            ? undefined
            : resolveWorkspacePath(workspace_path),          provider,
          limit,
        });

        return jsonContent({ success: true, count: snapshots.length, snapshots });
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

  server.tool(
    "record_health_check",
    describeTool("record_health_check"),
    {
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ workspace_path }) => {
      try {
        requireSupabase();
        const snapshots = await recordAllProviderHealth(resolveWorkspacePath(workspace_path));        return jsonContent({ success: true, snapshots });
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
