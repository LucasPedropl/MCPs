import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BridgeProvider } from "@mcps/shared";
import { errorText, jsonText } from "@mcps/shared";
import { resolveWorkspacePath } from "../modules/orchestration/client/workspace-resolve.js";
import { runDelegation } from "../modules/orchestration/tools/delegation.js";
import {
  addSharedContext,
  createSession,
  getSession,
} from "../modules/orchestration/features/sessions/session-store.js";
import { describeAgentTool } from "./tool-docs.js";

function routeForPedro(intent: string): {
  provider: BridgeProvider;
  rationale: string;
} {
  const lower = intent.toLowerCase();

  if (/(migration|rls|sql|supabase|schema|policy)/.test(lower)) {
    return {
      provider: "cursor",
      rationale: "Tarefa de banco/RLS: Cursor com data module.",
    };
  }

  if (/(feature|implement|refactor|architecture|large)/.test(lower)) {
    return {
      provider: "antigravity",
      rationale: "Tarefa grande: Antigravity.",
    };
  }

  if (/(bug|fix|typo|small|quick)/.test(lower)) {
    return {
      provider: "cursor",
      rationale: "Correção pequena: Cursor.",
    };
  }

  return {
    provider: "cursor",
    rationale: "Default pessoal: Cursor.",
  };
}

export function registerAgentOsOrchestrationExtensions(server: McpServer): void {
  server.registerTool(
    "route_for_pedro",
    {
      description: describeAgentTool("route_for_pedro"),
      inputSchema: { intent: z.string() },
    },
    async (args) => jsonText(routeForPedro(args.intent)),
  );

  server.registerTool(
    "handoff_session",
    {
      description: describeAgentTool("handoff_session"),
      inputSchema: {
        session_id: z.string(),
        target_provider: z.enum(["cursor", "antigravity", "copilot"]),
        prompt: z.string(),
        context_label: z.string().optional(),
        context_content: z.string().optional(),
        workspace_path: z.string().optional(),
      },
    },
    async (args) => {
      const session = await getSession(args.session_id);
      if (!session) {
        return errorText(`Sessão '${args.session_id}' não encontrada.`);
      }

      if (args.context_content) {
        await addSharedContext({
          sessionId: args.session_id,
          workspace: session.workspace,
          label: args.context_label ?? "handoff_context",
          content: args.context_content,
        });
      }

      const workspace = resolveWorkspacePath(args.workspace_path ?? session.workspace);
      const delegation = await runDelegation({
        provider: args.target_provider,
        prompt: args.prompt,
        mode: "subagent",
        agentic_mode: false,
        timeout_ms: 180_000,
        workspace_path: workspace,
        session_id: session.external_session_id ?? undefined,
      });

      return jsonText({
        handoff: true,
        from: session.provider,
        to: args.target_provider,
        delegation,
      });
    },
  );

  server.registerTool(
    "resume_task",
    {
      description: describeAgentTool("resume_task"),
      inputSchema: {
        task_id: z.string(),
        prompt: z.string(),
        provider: z.enum(["cursor", "antigravity", "copilot"]).optional(),
        workspace_path: z.string().optional(),
      },
    },
    async (args) => {
      const workspace = resolveWorkspacePath(args.workspace_path);
      const provider = args.provider ?? "cursor";
      const fullPrompt = `[resume_task:${args.task_id}] ${args.prompt}`;

      const delegation = await runDelegation({
        provider,
        prompt: fullPrompt,
        mode: "subagent",
        agentic_mode: false,
        timeout_ms: 180_000,
        workspace_path: workspace,
      });

      if (!delegation.success) {
        return errorText(delegation.message);
      }

      const session = await createSession({
        workspace,
        provider,
        title: `resume:${args.task_id}`,
        externalSessionId: delegation.sessionId ?? delegation.cascadeId,
        model: delegation.model,
        lastPrompt: fullPrompt,
        lastResponse: delegation.response,
        metadata: { task_id: args.task_id },
      });

      return jsonText({
        task_id: args.task_id,
        session,
        delegation,
      });
    },
  );
}
