/** Retorna description enriquecida ou fallback. */
export function describeTool(name: string, fallback?: string): string {
  return TOOL_DESCRIPTIONS[name] ?? fallback ?? name;
}

export const BRIDGE_INSTRUCTIONS = `
# IDE Bridge MCP v1.0 — Agent Instructions

You orchestrate coding tasks by delegating to Antigravity, Cursor CLI, or Copilot CLI.
Always call \`get_usage_guide\` or \`bridge_status\` first in a new workspace to confirm target path and provider health.

## Workspace resolution (priority order)
1. \`workspace_path\` parameter on any delegation tool (explicit override)
2. \`BRIDGE_DEFAULT_CWD\` env in mcp.json
3. Cursor \`WORKSPACE_FOLDER_PATHS\` (auto when MCP runs inside a project)
4. \`ANTIGRAVITY_WORKSPACE\` env fallback

Per-project setup: use \`"BRIDGE_DEFAULT_CWD": "\${workspaceFolder}"\` in .cursor/mcp.json.

## Mode: subagent vs bridge
- **subagent** (default): background Cascade/subagent — no UI focus, ideal for parallel work.
- **bridge**: sends prompt to Antigravity chat panel (visible in IDE).

## agentic_mode
- **false**: read-only or chat-only — no file edits, no git worktree.
- **true**: provider may edit files. Creates isolated git worktree + auto-merge on success.
  Use only when you intend code changes. Test with agentic_mode=false first in new projects.

## Decision tree — which tool?
| Need | Tool |
|------|------|
| Quick answer, text only, <2min | \`delegate_and_wait\` |
| Full JSON metadata (merge, branch, sessionId) | \`delegate_task\` |
| Long task, poll later, needs Supabase | \`delegate_async\` → \`get_job_status\` |
| Multi-step plan→implement→review→fix | \`run_pipeline\` |
| Same prompt, multiple providers | \`delegate_parallel\` |
| Smart provider pick | \`route_prompt\` |
| Multi-turn context | \`create_session\` → \`continue_session\` |

## Prerequisites
- **delegate_async / run_pipeline / sessions**: Supabase (\`BRIDGE_SUPABASE_KEY\` in mcp.json)
- **HITL approval**: \`BRIDGE_HITL_ENABLED=1\`
- **Realtime worker**: \`BRIDGE_REALTIME_WORKER=1\`
- **Cursor provider**: \`agent login\` must work
- **Copilot**: student/light plan — use \`gpt-5.2\` or \`auto\` only

## Quota pools (Antigravity)
- **gemini**: Gemini Flash/Pro models — separate reset cycle
- **external**: Claude + GPT-OSS — shared pool, check \`bridge_status.quotaPools\`

## Inter-agent language (token savings)
- Default \`BRIDGE_DELEGATION_LANG=en\` — orchestrator ↔ Antigravity in English (~15–25% fewer tokens vs PT).
- Write delegation prompts in English when calling \`delegate_task\` / \`delegate_async\`.
- Pipeline step prompts auto-switch EN/PT. Set \`BRIDGE_DELEGATION_LANG=pt\` to disable EN prefix.
- Optional \`BRIDGE_DELEGATION_LANG_ALL=1\` applies EN prefix to Cursor/Copilot too.

## Safety
- Verify \`bridge_status.targetWorkspace\` matches your project before agentic_mode=true
- Use \`idempotency_key\` in delegate_async to prevent duplicate jobs on retry
- \`cancel_job\` stops pending/running jobs; cascades to child jobs
`.trim();

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
RETURNS: { success, provider, mode, response, isolatedBranch?, merge?, sessionId?, cascadeId?, attemptedProviders? }
PARAMS: provider, prompt, model?, mode(subagent|bridge), agentic_mode, workspace_path?, timeout_ms
NOTES: Uses fallback chain if primary provider fails. agentic_mode=true creates worktree isolation.
`.trim(),

  delegate_and_wait: `
WHEN TO USE: Quick synchronous task — returns ONLY the response text (no JSON wrapper).
WHEN NOT: When you need merge/worktree metadata. For tasks >2min or fire-and-forget.
RETURNS: Plain text string (response body only)
PARAMS: provider(default antigravity), prompt, model?, mode(subagent|bridge), agentic_mode, workspace_path?, timeout_ms
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
RETURNS: { success, sessionId, provider, externalSessionId, response }
PARAMS: provider, prompt, title?, model?, agentic_mode, workspace_path?, timeout_ms
NOTES: Sessions are scoped to workspace. Use continue_session for follow-ups.
`.trim(),

  continue_session: `
WHEN TO USE: Send follow-up prompt to existing session with optional context pack injection.
WHEN NOT: Without valid session_id from create_session.
RETURNS: { success, sessionId, response, contextUsed? }
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
NOTES: Default steps use Antigravity/Cursor/Copilot. Cursor fallback if unavailable. Requires Supabase for async.
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

export const MODE_DESC =
  "subagent = background sem UI. bridge = chat visível no Antigravity (só antigravity).";
