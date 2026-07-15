import { compactToolDoc } from "@mcps/shared";
import { getToolDocsMode } from "../../../config/env.js";

/**
 * Retorna description enriquecida ou fallback. Em modo compact (default,
 * env AGENT_OS_TOOL_DOCS) devolve resumo+RETURNS; doc completa via
 * get_usage_guide tool_name=...
 */
export function describeTool(name: string, fallback?: string): string {
  const full = TOOL_DESCRIPTIONS[name];
  if (!full) {
    return fallback ?? name;
  }
  if (getToolDocsMode() === "full") {
    return full;
  }
  return COMPACT_TOOL_DESCRIPTION_OVERRIDES[name] ?? compactToolDoc(full);
}

/**
 * Overrides compactos à mão para as tools de delegação confundíveis:
 * o contraste do WHEN NOT vive na linha-resumo.
 */
export const COMPACT_TOOL_DESCRIPTION_OVERRIDES: Record<string, string> = {
  delegate_task: `Synchronous delegation with FULL JSON metadata (merge, isolatedBranch, sessionId). For plain-text-only answers use delegate_and_wait; for tasks >2min use delegate_async.
RETURNS: { success, provider, mode, response, isolatedBranch?, merge?, sessionId?, cascadeId?, awaiting_plan_approval?, attemptedProviders? }`,

  delegate_and_wait: `Quick synchronous delegation returning ONLY the response text (no JSON wrapper). For merge/worktree metadata use delegate_task; for long/background tasks use delegate_async.
RETURNS: Plain text string (response body only)`,

  delegate_async: `Long or background delegation — returns job_id immediately, poll with get_job_status. REQUIRES Supabase. For synchronous results use delegate_task or delegate_and_wait.
RETURNS: { success, jobId, status, provider, workspace, message }`,

  run_pipeline: `Full autonomous workflow: plan→implement→review→fix with validation and review-fix loops. For trivial changes or simple questions use delegate_task/delegate_and_wait.
RETURNS: { success, jobId/pipelineId, status } (async default) or full pipeline result (async=false)`,

  get_job_status: `Poll async job by job_id — wait 3-10s between calls and check isTerminal. For provider/quota health use bridge_status.
RETURNS: { success, job, events[], isTerminal }`,

  bridge_status: `Health check: providers (Cursor + Antigravity), Supabase, quotas, workspace, circuit breaker. For a specific job use get_job_status; for a pipeline use get_pipeline_status.
RETURNS: Resumo enxuto por padrão. verbose=true inclui antigravityHealth raw.`,
};

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_usage_guide: `
WHEN TO USE: First call in any new workspace/project. Returns dynamic decision tree, warnings, quotas, provider health.
WHEN NOT: When you already confirmed workspace and providers via bridge_status.
RETURNS: { recommendedFlow, decisionTree, providersStatus, featuresEnabled, workspaceInfo, quotaSummary, warnings }
NOTES: Best entry point for external AIs unfamiliar with this MCP.
`.trim(),

  bridge_status: `
WHEN TO USE: Health check — providers (Cursor + Antigravity), Supabase, quotas, workspace, circuit breaker.
WHEN NOT: For a specific job (use get_job_status) or pipeline (use get_pipeline_status).
RETURNS: Resumo enxuto por padrão. verbose=true inclui antigravityHealth raw.
PARAMS: verbose?
NOTES: Check quotaPools antes de delegações pesadas. Verify workspace.target matches your project.
`.trim(),

  list_models: `
WHEN TO USE: Discover available models and quotas for antigravity or cursor.
WHEN NOT: When model is already known. For routing logic use antigravity modelRouter in response.
RETURNS: { provider, models[], modelRouter?, defaultModel, source }
NOTES: Antigravity shows quotaRemaining per model.
`.trim(),

  delegate_task: `
WHEN TO USE: Synchronous delegation with FULL JSON response (success, merge, isolatedBranch, sessionId, cascadeId).
WHEN NOT: When you only need plain text (use delegate_and_wait). For long tasks >2min (use delegate_async).
RETURNS: { success, provider, mode, response, isolatedBranch?, merge?, sessionId?, cascadeId?, awaiting_plan_approval?, attemptedProviders? }
PARAMS: provider, prompt, model?, mode(subagent|bridge), agentic_mode, planner_mode?, workspace_path?, timeout_ms
NOTES: Uses fallback chain if primary provider fails. agentic_mode=true creates worktree isolation. Default planner_mode=off (PLANNING_OFF). If awaiting_plan_approval, use create_session + continue_session(approve_plan=true).
`.trim(),

  delegate_and_wait: `
WHEN TO USE: Quick synchronous task — returns ONLY the response text (no JSON wrapper).
WHEN NOT: When you need merge/worktree metadata. For tasks >2min or fire-and-forget.
RETURNS: Plain text string (response body only)
PARAMS: provider(default antigravity), prompt, model?, mode(subagent|bridge), agentic_mode, planner_mode?, workspace_path?, timeout_ms
NOTES: Simplest delegation. Errors return as error text with isError flag.
`.trim(),

  delegate_async: `
WHEN TO USE: Long or background tasks. Returns job_id immediately; poll with get_job_status.
WHEN NOT: When you need synchronous result (use delegate_task or delegate_and_wait).
RETURNS: { success, jobId, status, provider, workspace, message }
PARAMS: provider, prompt, model?, mode, agentic_mode, workspace_path?, timeout_ms, idempotency_key?
NOTES: REQUIRES Supabase. Use idempotency_key to prevent duplicate jobs on retry. Same key + workspace returns existing job.
`.trim(),

  get_job_status: `
WHEN TO USE: Poll async job by job_id. Check isTerminal before stopping poll loop.
WHEN NOT: In tight loops — wait 3-10s between calls.
RETURNS: { success, job, events[], isTerminal }
NOTES: Status values: pending, running, completed, failed, cancelled, awaiting_approval.
`.trim(),

  list_jobs: `
WHEN TO USE: List recent jobs for current workspace. Filter by status/provider.
WHEN NOT: When you have job_id (use get_job_status directly).
RETURNS: { success, count, jobs[] }
PARAMS: status?, provider?, limit, all_workspaces(default false), workspace_path?
NOTES: Default filters to current workspace only. Set all_workspaces=true for cross-project view.
`.trim(),

  cancel_job: `
WHEN TO USE: Stop pending/running job. Also cancels child jobs (cascade).
WHEN NOT: For completed/failed jobs.
RETURNS: { success, job, childrenCancelled }
NOTES: Provider may finish current in-flight chunk before stopping.
`.trim(),

  job_admin: `
Job administration: DLQ, metrics, HITL approval, store connectivity.
WHEN TO USE: action=dlq for jobs failed after all retries; action=metrics for token/cost of completed job; action=approve for HITL step awaiting_approval (needs BRIDGE_HITL_ENABLED=1); action=store_status for quick Supabase connectivity check.
WHEN NOT: Normal monitoring — use list_jobs / get_job_status.
RETURNS: Per action — { jobs[] } | { metrics } | { approved, resumed? } | { configured, reachable, hint }
PARAMS: action(dlq|metrics|approve|store_status), job_id?, approved?, comment?, limit, all_workspaces, workspace_path?
`.trim(),

  create_session: `
WHEN TO USE: Start persistent multi-turn session with a provider (optional, not required for delegation).
WHEN NOT: For one-shot tasks — use delegate_task directly.
RETURNS: { success, sessionId, provider, externalSessionId, cascadeId?, response, awaiting_plan_approval? }
PARAMS: provider, prompt, title?, model?, agentic_mode, planner_mode?, workspace_path?, timeout_ms
NOTES: Sessions are scoped to workspace. Use continue_session for follow-ups / plan approval.
`.trim(),

  continue_session: `
WHEN TO USE: Send follow-up prompt to existing session; or approve/reject Antigravity plan (approve_plan / reject_plan).
WHEN NOT: Without valid session_id from create_session.
RETURNS: { success, session, response, resumedNative, awaiting_plan_approval?, plan_action? }
PARAMS: session_id, prompt?, model?, agentic_mode, planner_mode?, approve_plan?, reject_plan?, timeout_ms, include_context_pack
NOTES: approve_plan=true sends fixed EN approval on the same cascade with PLANNING_OFF + agentic. prompt optional when approve/reject set.
`.trim(),

  session_admin: `
Session administration: inspect, list, and inject context.
WHEN TO USE: action=get for session metadata + recent context; action=list to find sessions in workspace; action=add_context to inject file contents/diffs/notes for next continue_session.
WHEN NOT: To execute a new prompt — use continue_session.
RETURNS: Per action — { session, context[] } | { sessions[] } | { context }
PARAMS: action(get|list|add_context), session_id?, provider?, limit, content?, label?, content_type, workspace_path?
`.trim(),

  run_pipeline: `
WHEN TO USE: Full autonomous workflow: plan→implement→review→fix with Zod validation and review-fix loops.
WHEN NOT: Trivial one-line changes or simple questions.
RETURNS: { success, jobId/pipelineId, status } (async default) or full pipeline result (async=false)
PARAMS: task, steps?, step_roles?, timeout_ms, async(default true), workspace_path?
NOTES: Default steps use Antigravity/Cursor. Cursor fallback if unavailable. Requires Supabase for async.
`.trim(),

  resume_pipeline: `
WHEN TO USE: Resume failed/cancelled pipeline from last checkpoint.
WHEN NOT: For new tasks — use run_pipeline.
RETURNS: { success, pipelineId, resumedFromStep, status }
`.trim(),

  get_pipeline_status: `
WHEN TO USE: Check pipeline progress and child step jobs.
WHEN NOT: For single isolated jobs.
RETURNS: { success, pipeline, steps[], childJobs[] }
`.trim(),

  delegate_parallel: `
WHEN TO USE: Same prompt to multiple providers simultaneously with merge strategy.
WHEN NOT: When steps depend on each other sequentially.
RETURNS: { success, results?, mergedResponse?, jobId? } sync or async
PARAMS: prompt, providers?, auto_route, merge_strategy(raw_all|best_of|consensus), workspace_path?, async
NOTES: Respect rate limits. auto_route picks providers by prompt type.
`.trim(),

  route_prompt: `
WHEN TO USE: Get recommended providers for a prompt without executing (preview routing).
WHEN NOT: To actually delegate — use delegate_parallel or delegate_task.
RETURNS: { prompt, category, providers[], reasoning }
`.trim(),

  job_observability: `
Job/provider observability: streaming chunks and health snapshots.
WHEN TO USE: action=chunks to stream partial output of a running async job; action=health_history for historical provider snapshots; action=record_health to force a probe now.
WHEN NOT: For live provider status — use bridge_status.
RETURNS: Per action — { chunks[] } | { snapshots[] }
PARAMS: action(chunks|health_history|record_health), job_id?, since_seq, limit, provider?, all_workspaces, workspace_path?
`.trim(),

  webhooks: `
GitHub webhooks and Realtime worker management.
WHEN TO USE: action=trigger_github simulates push/PR/ping webhook enqueueing a delegation job; action=worker_status|worker_start|worker_stop manages the Supabase Realtime worker; action=verify_signature debugs HMAC X-Hub-Signature-256.
WHEN NOT: Normal delegation — use delegate_task/delegate_async.
RETURNS: Per action — { jobId, prompt } | { running, hint } | { valid }
PARAMS: action, event(push|pull_request|ping), repo, provider, agentic_mode, payload?, signature?, workspace_path?
NOTES: Worker auto-start requires BRIDGE_REALTIME_WORKER=1 at server start.
`.trim(),
};

/** Schema Zod compartilhado — descrição para workspace_path. */
export const WORKSPACE_PATH_DESC =
  "Override explícito do diretório do projeto. Omita para usar Cursor WORKSPACE_FOLDER_PATHS ou BRIDGE_DEFAULT_CWD.";

export const IDEMPOTENCY_KEY_DESC =
  "Chave única para evitar jobs duplicados em retries. Mesma chave+workspace retorna job existente.";

export const AGENTIC_MODE_DESC =
  "true = provider pode editar arquivos (worktree isolation + auto-merge). false = chat/read-only.";

export const PLANNER_MODE_DESC =
  "Antigravity only: off=PLANNING_OFF (default, executa sem pedir confirmação), on=PLANNING_ON, default=DEFAULT. Env: BRIDGE_ANTIGRAVITY_PLANNER_MODE.";

export const MODE_DESC =
  "subagent = background sem UI. bridge = chat visível no Antigravity (só antigravity).";
