import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonText } from "@mcps/shared";
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
  getSupabaseUrl,
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

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase não configurado. Adicione AGENT_OS_SUPABASE_URL e AGENT_OS_SUPABASE_KEY ao env do agent-os no mcp.json.",
    );
  }
}

export function registerJobTools(server: McpServer): void {
  server.registerTool(
    "delegate_async",
    {
      description: describeTool("delegate_async"),
      inputSchema: {
      provider: z.enum(["antigravity", "cursor"]),
      prompt: z.string().min(1),
      model: z.string().optional(),
      mode: z.enum(["subagent", "bridge"]).default("subagent").describe(MODE_DESC),
      agentic_mode: z.boolean().default(false).describe(AGENTIC_MODE_DESC),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      idempotency_key: z.string().min(1).max(128).optional().describe(IDEMPOTENCY_KEY_DESC),
      timeout_ms: z.number().default(120_000),
      },
    },
    async (params) => {
      try {
        requireSupabase();
        const workspace = resolveWorkspacePath(params.workspace_path);

        if (params.idempotency_key) {
          const existing = await findJobByIdempotencyKey(workspace, params.idempotency_key);
          if (existing && isIdempotentReuse(existing)) {
            return jsonText({
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
            ...jsonText({
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

        return jsonText({
          success: true,
          jobId: job.id,
          status: job.status,
          provider: job.provider,
          workspace: job.workspace,
          message: "Job enfileirado. Use get_job_status para acompanhar.",
        });
      } catch (error) {
        return {
          ...jsonText({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_job_status",
    {
      description: describeTool("get_job_status"),
      inputSchema: {
      job_id: z.string().uuid(),
      },
    },
    async ({ job_id }) => {
      try {
        requireSupabase();
        const snapshot = await getJobWithEvents(job_id);
        if (!snapshot) {
          return {
            ...jsonText({ success: false, message: `Job ${job_id} não encontrado` }),
            isError: true,
          };
        }

        return jsonText({
          success: true,
          ...snapshot,
          isTerminal: ["completed", "failed", "cancelled"].includes(snapshot.job.status),
        });
      } catch (error) {
        return {
          ...jsonText({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description: describeTool("list_jobs"),
      inputSchema: {
      status: z
        .enum(["pending", "running", "completed", "failed", "cancelled", "awaiting_approval"])
        .optional(),
      provider: z.enum(["antigravity", "cursor"]).optional(),
      limit: z.number().int().min(1).max(100).default(20),
      all_workspaces: z.boolean().default(false),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      },
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

        return jsonText({ success: true, count: jobs.length, jobs });
      } catch (error) {
        return {
          ...jsonText({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "cancel_job",
    {
      description: describeTool("cancel_job"),
      inputSchema: {
      job_id: z.string().uuid(),
      },
    },
    async ({ job_id }) => {
      try {
        requireSupabase();
        const job = await cancelJob(job_id);
        if (!job.job) {
          return {
            ...jsonText({ success: false, message: `Job ${job_id} não encontrado` }),
            isError: true,
          };
        }

        return jsonText({
          success: true,
          job: job.job,
          childrenCancelled: job.childrenCancelled,
        });
      } catch (error) {
        return {
          ...jsonText({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "job_admin",
    {
      description: describeTool("job_admin"),
      inputSchema: {
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
    },
    async ({ action, job_id, approved, comment, limit, all_workspaces, workspace_path }) => {
      try {
        if (action === "store_status") {
          const configured = isSupabaseConfigured();
          const reachable = configured ? await probeSupabaseConnection() : false;
          return jsonText({
            configured,
            reachable,
            url: getSupabaseUrl(),
            hint: configured
              ? reachable
                ? "Job store operacional."
                : "Key configurada mas conexão falhou — verifique RLS ou key."
              : "Defina AGENT_OS_SUPABASE_URL e AGENT_OS_SUPABASE_KEY no mcp.json.",
          });
        }

        requireSupabase();

        if (action === "dlq") {
          const jobs = await listDlqJobs({
            workspace: all_workspaces ? undefined : resolveWorkspacePath(workspace_path),
            limit,
          });
          return jsonText({ success: true, count: jobs.length, jobs });
        }

        if (action === "metrics") {
          if (!job_id) {
            return { ...jsonText({ success: false, message: "action=metrics exige job_id" }), isError: true };
          }
          const metrics = await getJobMetrics(job_id);
          if (!metrics) {
            return {
              ...jsonText({ success: false, message: `Métricas não encontradas para ${job_id}` }),
              isError: true,
            };
          }
          return jsonText({ success: true, jobId: job_id, metrics });
        }

        // approve
        if (!job_id || approved === undefined) {
          return {
            ...jsonText({ success: false, message: "action=approve exige job_id e approved" }),
            isError: true,
          };
        }
        if (!isHitlEnabled()) {
          return {
            ...jsonText({
              success: false,
              message: "HITL desabilitado. Defina BRIDGE_HITL_ENABLED=1 no env.",
            }),
            isError: true,
          };
        }
        const result = await approveJobStep(job_id, approved, comment);
        return jsonText({ success: true, ...result });
      } catch (error) {
        return {
          ...jsonText({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        };
      }
    },
  );
}
