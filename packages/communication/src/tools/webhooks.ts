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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formata resposta MCP padrão com JSON serializado. */
function jsonContent(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Formata resposta de erro MCP. */
function errorContent(message: string) {
  return {
    ...jsonContent({ success: false, message }),
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/** Registra tools de webhook e realtime worker no MCP server. */
export function registerWebhookTools(server: McpServer): void {
  registerTriggerGitHubWebhook(server);
  registerRealtimeWorkerStatus(server);
  registerVerifyGitHubSignature(server);
}

// ---------------------------------------------------------------------------
// trigger_github_webhook
// ---------------------------------------------------------------------------

function registerTriggerGitHubWebhook(server: McpServer): void {
  server.tool(
    "trigger_github_webhook",
    describeTool("trigger_github_webhook"),
    {
      event: z
        .enum(["push", "pull_request", "ping"])
        .default("push")
        .describe("Tipo do evento GitHub a simular"),
      ref: z
        .string()
        .optional()
        .describe("Branch ref (ex: refs/heads/main)"),
      title: z
        .string()
        .optional()
        .describe("Título do PR (apenas para pull_request)"),
      body: z
        .string()
        .optional()
        .describe("Body do commit ou descrição do PR"),
      repo: z
        .string()
        .default("owner/repo")
        .describe("Nome completo do repositório (owner/repo)"),
      provider: z
        .enum(["antigravity", "cursor", "copilot"])
        .default("antigravity")
        .describe("Provider alvo para delegação"),
      agentic_mode: z
        .boolean()
        .default(false)
        .describe(AGENTIC_MODE_DESC),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      timeout_ms: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Timeout customizado em ms"),
    },
    async ({ event, ref, title, body, repo, provider, agentic_mode, workspace_path, timeout_ms }) => {
      try {
        if (!isSupabaseConfigured()) {
          return errorContent("Supabase não configurado — impossível enfileirar job");
        }

        const payload: GitHubWebhookPayload = buildSimulatedPayload(
          event,
          { ref, title, body, repo },
        );

        const result = await handleGitHubWebhook(event, payload, {
          provider,
          agentic: agentic_mode,
          timeoutMs: timeout_ms,
          workspacePath: workspace_path,
        });

        return jsonContent({
          success: true,
          jobId: result.jobId,
          prompt: result.prompt,
          event: result.event,
          repo: result.repo,
          provider,
          agenticMode: agentic_mode,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[webhooks-tool] trigger_github_webhook falhou: ${message}`);
        return errorContent(message);
      }
    },
  );
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

  // ping
  return base;
}

// ---------------------------------------------------------------------------
// realtime_worker_status
// ---------------------------------------------------------------------------

function registerRealtimeWorkerStatus(server: McpServer): void {
  server.tool(
    "realtime_worker_status",
    describeTool("realtime_worker_status"),
    {
      action: z
        .enum(["status", "start", "stop"])
        .default("status")
        .describe("Ação: consultar status, iniciar ou parar o worker"),
    },
    async ({ action }) => {
      if (action === "start") {
        if (!isSupabaseConfigured()) {
          return errorContent("Supabase não configurado — worker não pode iniciar");
        }

        const started = startRealtimeWorker();
        const status = getRealtimeWorkerStatus();

        return jsonContent({
          action: "start",
          started,
          ...status,
          hint: started
            ? "Worker iniciado — jobs pending serão processados automaticamente"
            : "Worker já estava rodando ou foi desabilitado via env",
        });
      }

      if (action === "stop") {
        const wasRunning = isRealtimeWorkerRunning();
        stopRealtimeWorker();

        return jsonContent({
          action: "stop",
          stopped: wasRunning,
          running: false,
          hint: wasRunning
            ? "Worker parado com sucesso"
            : "Worker já estava parado",
        });
      }

      // status
      const status = getRealtimeWorkerStatus();
      return jsonContent({
        action: "status",
        ...status,
        webhookSecretConfigured: Boolean(getWebhookSecret()),
        hint: status.running
          ? "Worker ativo — monitorando inserts de jobs"
          : "Worker inativo. Use action='start' para iniciar",
      });
    },
  );
}

// ---------------------------------------------------------------------------
// verify_github_signature
// ---------------------------------------------------------------------------

function registerVerifyGitHubSignature(server: McpServer): void {
  server.tool(
    "verify_github_signature",
    describeTool("verify_github_signature"),
    {
      payload: z
        .string()
        .describe("Corpo raw do payload a verificar"),
      signature: z
        .string()
        .describe("Header X-Hub-Signature-256 completo (sha256=...)"),
    },
    async ({ payload, signature }) => {
      const secret = getWebhookSecret();
      if (!secret) {
        return jsonContent({
          valid: false,
          message: "BRIDGE_GITHUB_WEBHOOK_SECRET não definido no ambiente",
        });
      }

      const valid = verifyGitHubSignature(payload, signature, secret);
      return jsonContent({
        valid,
        message: valid
          ? "Assinatura válida ✓"
          : "Assinatura inválida — verifique o secret e o payload",
      });
    },
  );
}
