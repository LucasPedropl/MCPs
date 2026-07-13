import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";
import { enqueueJob, enqueuePipelineResume } from "../features/jobs/job-runner.js";
import { appendJobEvent } from "../features/jobs/job-store.js";
import { isSupabaseConfigured } from "../features/jobs/supabase-client.js";
import {
  createPipelineJob,
  executePipelineJob,
  getPipelineSnapshot,
  resumePipelineJob,
} from "../features/pipeline/pipeline-runner.js";
import { DEFAULT_PIPELINE_STEPS } from "../features/pipeline/templates.js";
import type { PipelineStepConfig, PipelineStepRole } from "../features/pipeline/types.js";
import { describeTool, WORKSPACE_PATH_DESC } from "./tool-docs.js";
import { guardDelegation } from "./policy-guard.js";

const stepSchema = z.object({
  role: z.enum(["plan", "implement", "review", "fix"]),
  provider: z.enum(["antigravity", "cursor"]),
  model: z.string().optional(),
  agentic_mode: z.boolean().optional(),
});

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

function resolveSteps(
  custom?: PipelineStepConfig[],
  roles?: PipelineStepRole[],
): PipelineStepConfig[] {
  if (custom && custom.length > 0) {
    return custom;
  }
  if (roles && roles.length > 0) {
    return roles.map((role) => {
      const base = DEFAULT_PIPELINE_STEPS.find((s) => s.role === role);
      if (!base) {
        throw new Error(`Step ${role} não encontrado no pipeline padrão`);
      }
      return base;
    });
  }
  return DEFAULT_PIPELINE_STEPS;
}

export function registerPipelineTools(server: McpServer): void {
  server.tool(
    "run_pipeline",
    describeTool("run_pipeline"),
    {
      task: z.string().min(1),
      steps: z.array(stepSchema).optional(),
      step_roles: z
        .array(z.enum(["plan", "implement", "review", "fix"]))
        .optional()
        .describe("Subset do pipeline padrão, ex: ['plan','review']"),
      timeout_ms: z.number().default(180_000).describe("Timeout por step"),
      async: z.boolean().default(true),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ task, steps, step_roles, timeout_ms, async: runAsync, workspace_path }) => {
      try {
        requireSupabase();

        const denial = await guardDelegation(task, "run_pipeline:*");
        if (denial) {
          return { ...jsonContent({ success: false, ...denial }), isError: true };
        }

        const resolvedSteps = resolveSteps(steps, step_roles);
        const input = { task, steps: resolvedSteps, timeout_ms };
        const workspace = resolveWorkspacePath(workspace_path);

        if (runAsync) {
          const pipelineJobId = await createPipelineJob(workspace, input);
          await appendJobEvent(pipelineJobId, "created", { type: "pipeline", async: true });
          enqueueJob(pipelineJobId);

          return jsonContent({
            success: true,
            async: true,
            pipelineJobId,
            steps: resolvedSteps.map((s) => ({ role: s.role, provider: s.provider })),
            message: "Pipeline enfileirado. Use get_pipeline_status para acompanhar.",
          });
        }

        const pipelineJobId = await createPipelineJob(workspace, input);
        const result = await executePipelineJob(pipelineJobId);

        return jsonContent({
          success: result.status === "completed",
          async: false,
          ...result,
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
    "resume_pipeline",
    describeTool("resume_pipeline"),
    {
      pipeline_job_id: z.string().uuid(),
      async: z.boolean().default(true),
    },
    async ({ pipeline_job_id, async: runAsync }) => {
      try {
        requireSupabase();

        if (runAsync) {
          await enqueuePipelineResume(pipeline_job_id);
          return jsonContent({
            success: true,
            async: true,
            pipelineJobId: pipeline_job_id,
            message: "Resume enfileirado. Use get_pipeline_status para acompanhar.",
          });
        }

        const result = await resumePipelineJob(pipeline_job_id);

        return jsonContent({
          success: result.status === "completed",
          message: "Pipeline resumido com sucesso.",
          ...result,
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
    "get_pipeline_status",
    describeTool("get_pipeline_status"),
    {
      pipeline_job_id: z.string().uuid(),
    },
    async ({ pipeline_job_id }) => {
      try {
        requireSupabase();
        const snapshot = await getPipelineSnapshot(pipeline_job_id);
        if (!snapshot) {
          return {
            ...jsonContent({ success: false, message: "Pipeline não encontrado" }),
            isError: true,
          };
        }

        return jsonContent({
          success: true,
          pipeline: snapshot.job,
          childJobs: snapshot.children.map((c) => ({
            id: c.id,
            provider: c.provider,
            status: c.status,
            role: (c.metadata as Record<string, unknown>)["pipelineRole"],
            responsePreview: c.response?.slice(0, 200),
          })),
          stepResults: snapshot.stepResults,
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
}
