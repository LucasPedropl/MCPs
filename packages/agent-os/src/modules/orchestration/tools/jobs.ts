import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";
import { enqueueJob, cancelJob, approveJobStep } from "../features/jobs/job-runner.js";
import {
  appendJobEvent,
  createJob,
  getJobWithEvents,
  listJobs,
} from "../features/jobs/job-store.js";
import { findJobByIdempotencyKey, isIdempotentReuse } from "../features/jobs/idempotency.js";
import { listDlqJobs } from "../features/jobs/job-dlq.js";
import { getJobMetrics } from "../features/jobs/job-metrics.js";
import { isHitlEnabled } from "../features/jobs/job-hitl.js";
import {
  isSupabaseConfigured,
  probeSupabaseConnection,
} from "../features/jobs/supabase-client.js";
import type { JobStatus } from "../features/jobs/types.js";
import {
  describeTool,
  AGENTIC_MODE_DESC,
  MODE_DESC,
  WORKSPACE_PATH_DESC,
  IDEMPOTENCY_KEY_DESC,
} from "./tool-docs.js";
import { guardDelegation } from "./policy-guard.js";

function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase não configurado. Adicione BRIDGE_SUPABASE_KEY ao env do ide-bridge no mcp.json global.",
    );
  }
}

export function registerJobTools(server: McpServer): void {
  server.tool(
    "delegate_async",
    describeTool("delegate_async"),
    {
      provider: z.enum(["antigravity", "cursor"]),
      prompt: z.string().min(1),
      model: z.string().optional(),
      mode: z.enum(["subagent", "bridge"]).default("subagent").describe(MODE_DESC),
      agentic_mode: z.boolean().default(false).describe(AGENTIC_MODE_DESC),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      idempotency_key: z.string().min(1).max(128).optional().describe(IDEMPOTENCY_KEY_DESC),
      timeout_ms: z.number().default(120_000),
    },
    async (params) => {
      try {
        requireSupabase();
        const workspace = resolveWorkspacePath(params.workspace_path);

        if (params.idempotency_key) {
          const existing = await findJobByIdempotencyKey(workspace, params.idempotency_key);
          if (existing && isIdempotentReuse(existing)) {
            return jsonContent({
              success: true,
              jobId: existing.id,
              status: existing.status,
              provider: existing.provider,
              workspace: existing.workspace,
              idempotentReuse: true,
              message: "Job existente reutilizado (idempotency_key).",
            });
          }
        }

        const denial = await guardDelegation(params.prompt, `delegate_async:${params.provider}`);
        if (denial) {
          return {
            ...jsonContent({
              success: false,
              message: denial.message,
              policyId: denial.policyId,
            }),
            isError: true,
          };
        }

        const job = await createJob({
          workspace,
          provider: params.provider,
          prompt: params.prompt,
          model: params.model,
          mode: params.mode,
          agenticMode: params.agentic_mode,
          timeoutMs: params.timeout_ms,
          idempotencyKey: params.idempotency_key,
        });

        await appendJobEvent(job.id, "created", { provider: params.provider });
        enqueueJob(job.id);

        return jsonContent({
          success: true,
          jobId: job.id,
          status: job.status,
          provider: job.provider,
          workspace: job.workspace,
          message: "Job enfileirado. Use get_job_status para acompanhar.",
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
    "get_job_status",
    describeTool("get_job_status"),
    {
      job_id: z.string().uuid(),
    },
    async ({ job_id }) => {
      try {
        requireSupabase();
        const snapshot = await getJobWithEvents(job_id);
        if (!snapshot) {
          return {
            ...jsonContent({ success: false, message: `Job ${job_id} não encontrado` }),
            isError: true,
          };
        }

        return jsonContent({
          success: true,
          ...snapshot,
          isTerminal: ["completed", "failed", "cancelled"].includes(snapshot.job.status),
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
    "list_jobs",
    describeTool("list_jobs"),
    {
      status: z
        .enum(["pending", "running", "completed", "failed", "cancelled", "awaiting_approval"])
        .optional(),
      provider: z.enum(["antigravity", "cursor"]).optional(),
      limit: z.number().int().min(1).max(100).default(20),
      all_workspaces: z.boolean().default(false),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ status, provider, limit, all_workspaces, workspace_path }) => {
      try {
        requireSupabase();
        const jobs = await listJobs({
          workspace: all_workspaces
            ? undefined
            : resolveWorkspacePath(workspace_path),
          status: status as JobStatus | undefined,
          provider,
          limit,
        });

        return jsonContent({ success: true, count: jobs.length, jobs });
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
    "cancel_job",
    describeTool("cancel_job"),
    {
      job_id: z.string().uuid(),
    },
    async ({ job_id }) => {
      try {
        requireSupabase();
        const job = await cancelJob(job_id);
        if (!job.job) {
          return {
            ...jsonContent({ success: false, message: `Job ${job_id} não encontrado` }),
            isError: true,
          };
        }

        return jsonContent({
          success: true,
          job: job.job,
          childrenCancelled: job.childrenCancelled,
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
    "job_admin",
    describeTool("job_admin"),
    {
      action: z
        .enum(["dlq", "metrics", "approve", "store_status"])
        .describe("dlq = jobs falhados após retries; metrics = tokens/custo; approve = HITL; store_status = conectividade"),
      job_id: z.string().uuid().optional(),
      approved: z.boolean().optional().describe("approve: aprovar (true) ou rejeitar (false)"),
      comment: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      all_workspaces: z.boolean().default(false),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ action, job_id, approved, comment, limit, all_workspaces, workspace_path }) => {
      try {
        if (action === "store_status") {
          const configured = isSupabaseConfigured();
          const reachable = configured ? await probeSupabaseConnection() : false;
          return jsonContent({
            configured,
            reachable,
            url: process.env["BRIDGE_SUPABASE_URL"] ?? "https://xrjjzyfevbuuxeundgds.supabase.co",
            hint: configured
              ? reachable
                ? "Job store operacional."
                : "Key configurada mas conexão falhou — verifique RLS ou key."
              : "Defina BRIDGE_SUPABASE_KEY no mcp.json global.",
          });
        }

        requireSupabase();

        if (action === "dlq") {
          const jobs = await listDlqJobs({
            workspace: all_workspaces ? undefined : resolveWorkspacePath(workspace_path),
            limit,
          });
          return jsonContent({ success: true, count: jobs.length, jobs });
        }

        if (action === "metrics") {
          if (!job_id) {
            return { ...jsonContent({ success: false, message: "action=metrics exige job_id" }), isError: true };
          }
          const metrics = await getJobMetrics(job_id);
          if (!metrics) {
            return {
              ...jsonContent({ success: false, message: `Métricas não encontradas para ${job_id}` }),
              isError: true,
            };
          }
          return jsonContent({ success: true, jobId: job_id, metrics });
        }

        // approve
        if (!job_id || approved === undefined) {
          return {
            ...jsonContent({ success: false, message: "action=approve exige job_id e approved" }),
            isError: true,
          };
        }
        if (!isHitlEnabled()) {
          return {
            ...jsonContent({
              success: false,
              message: "HITL desabilitado. Defina BRIDGE_HITL_ENABLED=1 no env.",
            }),
            isError: true,
          };
        }
        const result = await approveJobStep(job_id, approved, comment);
        return jsonContent({ success: true, ...result });
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
