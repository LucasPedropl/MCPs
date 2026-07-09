import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  handleGitHubWebhook,
  verifyGitHubSignature,
  getWebhookSecret,
  type GitHubWebhookPayload,
  type GitHubEventType,
} from "../features/webhooks/github-handler.js";
import {
  isRealtimeWorkerRunning,
  startRealtimeWorker,
  stopRealtimeWorker,
  getRealtimeWorkerStatus,
} from "../features/jobs/realtime-worker.js";
import { isSupabaseConfigured } from "../features/jobs/supabase-client.js";
import { describeTool, AGENTIC_MODE_DESC, WORKSPACE_PATH_DESC } from "./tool-docs.js";

function jsonContent(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorContent(message: string) {
  return { ...jsonContent({ success: false, message }), isError: true };
}

/** Constrói payload simulado para testes via MCP tool. */
function buildSimulatedPayload(
  event: GitHubEventType,
  params: { ref?: string; title?: string; body?: string; repo: string },
): GitHubWebhookPayload {
  const base: GitHubWebhookPayload = {
    ref: params.ref ?? "refs/heads/main",
    repository: { full_name: params.repo },
    sender: { login: "mcp-simulation" },
  };

  if (event === "pull_request") {
    return {
      ...base,
      action: "opened",
      pull_request: {
        title: params.title ?? "Simulated PR",
        body: params.body ?? "",
        number: 1,
        state: "open",
        head: { ref: "feature-branch", sha: "abc123" },
        base: { ref: "main", sha: "def456" },
      },
    };
  }

  if (event === "push") {
    return {
      ...base,
      commits: [
        {
          id: "simulated-commit-id",
          message: params.body ?? "simulated commit",
          author: { name: "MCP", email: "mcp@local" },
          timestamp: new Date().toISOString(),
          added: [],
          modified: [],
          removed: [],
        },
      ],
    };
  }

  return base;
}

type WebhooksArgs = {
  action: "trigger_github" | "worker_status" | "worker_start" | "worker_stop" | "verify_signature";
  event: "push" | "pull_request" | "ping";
  ref?: string;
  title?: string;
  body?: string;
  repo: string;
  provider: "antigravity" | "cursor" | "copilot";
  agentic_mode: boolean;
  workspace_path?: string;
  timeout_ms?: number;
  payload?: string;
  signature?: string;
};

async function handleWebhooks(args: WebhooksArgs) {
  if (args.action === "trigger_github") {
    if (!isSupabaseConfigured()) {
      return errorContent("Supabase não configurado — impossível enfileirar job");
    }
    const payload = buildSimulatedPayload(args.event, {
      ref: args.ref,
      title: args.title,
      body: args.body,
      repo: args.repo,
    });
    const result = await handleGitHubWebhook(args.event, payload, {
      provider: args.provider,
      agentic: args.agentic_mode,
      timeoutMs: args.timeout_ms,
      workspacePath: args.workspace_path,
    });
    return jsonContent({
      success: true,
      jobId: result.jobId,
      prompt: result.prompt,
      event: result.event,
      repo: result.repo,
      provider: args.provider,
      agenticMode: args.agentic_mode,
    });
  }

  if (args.action === "worker_start") {
    if (!isSupabaseConfigured()) {
      return errorContent("Supabase não configurado — worker não pode iniciar");
    }
    const started = startRealtimeWorker();
    return jsonContent({ action: "worker_start", started, ...getRealtimeWorkerStatus() });
  }

  if (args.action === "worker_stop") {
    const wasRunning = isRealtimeWorkerRunning();
    stopRealtimeWorker();
    return jsonContent({ action: "worker_stop", stopped: wasRunning, running: false });
  }

  if (args.action === "worker_status") {
    const status = getRealtimeWorkerStatus();
    return jsonContent({
      action: "worker_status",
      ...status,
      webhookSecretConfigured: Boolean(getWebhookSecret()),
    });
  }

  // verify_signature
  if (!args.payload || !args.signature) {
    return errorContent("action=verify_signature exige 'payload' e 'signature'.");
  }
  const secret = getWebhookSecret();
  if (!secret) {
    return jsonContent({
      valid: false,
      message: "BRIDGE_GITHUB_WEBHOOK_SECRET não definido no ambiente",
    });
  }
  const valid = verifyGitHubSignature(args.payload, args.signature, secret);
  return jsonContent({ valid, message: valid ? "Assinatura válida" : "Assinatura inválida" });
}

/** Registra tool unificada de webhooks e realtime worker. */
export function registerWebhookTools(server: McpServer): void {
  server.tool(
    "webhooks",
    describeTool("webhooks"),
    {
      action: z
        .enum(["trigger_github", "worker_status", "worker_start", "worker_stop", "verify_signature"])
        .describe("trigger_github simula webhook; worker_* gerencia Realtime worker; verify_signature valida HMAC"),
      event: z.enum(["push", "pull_request", "ping"]).default("push"),
      ref: z.string().optional().describe("Branch ref (ex: refs/heads/main)"),
      title: z.string().optional().describe("Título do PR (pull_request)"),
      body: z.string().optional(),
      repo: z.string().default("owner/repo"),
      provider: z.enum(["antigravity", "cursor", "copilot"]).default("antigravity"),
      agentic_mode: z.boolean().default(false).describe(AGENTIC_MODE_DESC),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      timeout_ms: z.number().int().positive().optional(),
      payload: z.string().optional().describe("verify_signature: corpo raw"),
      signature: z.string().optional().describe("verify_signature: header X-Hub-Signature-256"),
    },
    async (args) => {
      try {
        return await handleWebhooks(args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[webhooks-tool] falhou: ${message}`);
        return errorContent(message);
      }
    },
  );
}
