import { createHmac, timingSafeEqual } from "node:crypto";
import { agentOsEnv } from "../../../../config/env.js";
import { resolveWorkspacePath } from "../../client/workspace-resolve.js";
import { getTargetWorkspacePath } from "../../client/workspace.js";
import { createJob, appendJobEvent } from "../jobs/job-store.js";
import { enqueueJob } from "../jobs/job-runner.js";
import type { DelegationJobRow } from "../jobs/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Commit mínimo do payload push do GitHub. */
export interface GitHubCommit {
  id?: string;
  message?: string;
  author?: { name?: string; email?: string };
  timestamp?: string;
  added?: string[];
  modified?: string[];
  removed?: string[];
}

/** Representação tipada de um payload GitHub (push/PR/ping). */
export interface GitHubWebhookPayload {
  action?: string;
  ref?: string;
  before?: string;
  after?: string;
  repository?: {
    full_name?: string;
    clone_url?: string;
    default_branch?: string;
  };
  pull_request?: {
    title?: string;
    body?: string;
    number?: number;
    state?: string;
    head?: { ref?: string; sha?: string };
    base?: { ref?: string; sha?: string };
    diff_url?: string;
  };
  commits?: GitHubCommit[];
  sender?: { login?: string };
}

/** Tipo do evento GitHub suportado. */
export type GitHubEventType = "push" | "pull_request" | "ping";

/** Opções de processamento do webhook. */
export interface WebhookHandlerOptions {
  provider?: "antigravity" | "cursor";
  agentic?: boolean;
  timeoutMs?: number;
  workspacePath?: string;
}

/** Resultado do processamento de webhook. */
export interface WebhookHandlerResult {
  jobId: string;
  prompt: string;
  event: GitHubEventType;
  repo: string;
}

// ---------------------------------------------------------------------------
// Signature Verification (X-Hub-Signature-256)
// ---------------------------------------------------------------------------

/**
 * Valida X-Hub-Signature-256 com HMAC SHA-256 e comparação timing-safe.
 * Retorna `false` se o header estiver ausente, mal formatado ou inválido.
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const received = signature.slice("sha256=".length);

  if (expected.length !== received.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(received, "utf8"),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/** Constrói prompt descritivo a partir do payload GitHub. */
function buildPromptFromPayload(
  event: GitHubEventType,
  payload: GitHubWebhookPayload,
): string {
  const repo = payload.repository?.full_name ?? "unknown/repo";

  if (event === "pull_request" && payload.pull_request) {
    const pr = payload.pull_request;
    const branchInfo = pr.head?.ref && pr.base?.ref
      ? ` (${pr.head.ref} → ${pr.base.ref})`
      : "";
    const bodySnippet = pr.body
      ? `\nDescrição: ${pr.body.slice(0, 500)}`
      : "";
    return [
      `Review PR #${pr.number ?? 0}: ${pr.title ?? "Sem título"}${branchInfo}`,
      `Estado: ${pr.state ?? payload.action ?? "unknown"}`,
      `Repositório: ${repo}`,
      bodySnippet,
    ].filter(Boolean).join("\n");
  }

  if (event === "push" && payload.commits?.length) {
    const branch = payload.ref?.replace("refs/heads/", "") ?? "unknown";
    const commitMessages = payload.commits
      .map((c) => c.message)
      .filter((msg): msg is string => Boolean(msg))
      .slice(0, 10)
      .join("\n  - ");

    const filesChanged = payload.commits.reduce((acc, c) => {
      return acc + (c.added?.length ?? 0) + (c.modified?.length ?? 0) + (c.removed?.length ?? 0);
    }, 0);

    return [
      `Analise push em ${branch} (${repo})`,
      `Commits (${payload.commits.length}):`,
      `  - ${commitMessages}`,
      filesChanged > 0 ? `Arquivos alterados: ~${filesChanged}` : "",
      payload.sender?.login ? `Autor: ${payload.sender.login}` : "",
    ].filter(Boolean).join("\n");
  }

  if (event === "ping") {
    return `Ping webhook recebido de ${repo} — conectividade OK`;
  }

  return `Evento GitHub '${event}' em ${repo}`;
}

// ---------------------------------------------------------------------------
// Webhook Handler
// ---------------------------------------------------------------------------

/**
 * Processa webhook GitHub e enfileira job de delegação.
 *
 * @param event - Tipo do evento (push | pull_request | ping)
 * @param payload - Payload parseado do webhook
 * @param options - Provider alvo, modo agentic, timeout
 * @returns Job criado com ID e prompt gerado
 */
export async function handleGitHubWebhook(
  event: GitHubEventType,
  payload: GitHubWebhookPayload,
  options: WebhookHandlerOptions = {},
): Promise<WebhookHandlerResult> {
  const workspace = options.workspacePath
    ? resolveWorkspacePath(options.workspacePath)
    : getTargetWorkspacePath();
  const prompt = buildPromptFromPayload(event, payload);
  const provider = options.provider ?? "antigravity";
  const repo = payload.repository?.full_name ?? "unknown/repo";

  const job: DelegationJobRow = await createJob({
    workspace,
    provider,
    prompt,
    mode: "subagent",
    agenticMode: options.agentic ?? false,
    timeoutMs: options.timeoutMs ?? 180_000,
    metadata: {
      source: "github_webhook",
      event,
      repo,
      action: payload.action,
      sender: payload.sender?.login,
      ref: payload.ref,
      prNumber: payload.pull_request?.number,
    },
  });

  await appendJobEvent(job.id, "github_webhook_received", {
    event,
    repo,
    action: payload.action,
    commitCount: payload.commits?.length ?? 0,
    prNumber: payload.pull_request?.number,
  });

  enqueueJob(job.id);

  return { jobId: job.id, prompt, event, repo };
}

// ---------------------------------------------------------------------------
// Secret Helper
// ---------------------------------------------------------------------------

/** Retorna o webhook secret configurado via env, ou null se ausente. */
export function getWebhookSecret(): string | null {
  const raw = agentOsEnv("GITHUB_WEBHOOK_SECRET");
  return raw?.trim() || null;
}
