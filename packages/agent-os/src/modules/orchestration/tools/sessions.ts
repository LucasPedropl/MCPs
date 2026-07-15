import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonText } from "@mcps/shared";
import { z } from "zod";
import { resolveWorkspacePath } from "../client/workspace-resolve.js";
import { isSupabaseConfigured } from "../features/jobs/supabase-client.js";
import { continueSession } from "../features/sessions/session-runner.js";
import {
  addSharedContext,
  createSession,
  getSession,
  listSessions,
  listSharedContext,
} from "../features/sessions/session-store.js";
import { runDelegation } from "./delegation.js";
import {
  describeTool,
  AGENTIC_MODE_DESC,
  PLANNER_MODE_DESC,
  WORKSPACE_PATH_DESC,
} from "./tool-docs.js";

const plannerModeSchema = z.enum(["off", "on", "default"]).optional();

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase não configurado. Necessário para ferramentas de sessão.",
    );
  }
}

export function registerSessionTools(server: McpServer): void {
  server.tool(
    "create_session",
    describeTool("create_session"),
    {
      provider: z.enum(["antigravity", "cursor"]),
      prompt: z.string().min(1),
      title: z.string().optional(),
      model: z.string().optional(),
      agentic_mode: z.boolean().default(false).describe(AGENTIC_MODE_DESC),
      planner_mode: plannerModeSchema.describe(PLANNER_MODE_DESC),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
      timeout_ms: z.number().default(120_000),
    },
    async ({
      provider,
      prompt,
      title,
      model,
      agentic_mode,
      planner_mode,
      workspace_path,
      timeout_ms,
    }) => {
      try {
        requireSupabase();
        const workspace = resolveWorkspacePath(workspace_path);
        const result = await runDelegation({
          provider,
          prompt,
          model,
          mode: "subagent",
          agentic_mode,
          planner_mode,
          timeout_ms,
          workspace_path: workspace,
        });
        if (!result.success) {
          return { ...jsonText({ success: false, message: result.message }), isError: true };
        }

        const session = await createSession({
          workspace,
          provider,
          title: title ?? prompt.slice(0, 80),
          externalSessionId: result.sessionId ?? result.cascadeId,
          model: result.model ?? model,
          lastPrompt: prompt,
          lastResponse: result.response,
        });

        return jsonText({
          success: true,
          sessionId: session.id,
          provider,
          externalSessionId: session.external_session_id,
          cascadeId: result.cascadeId,
          response: result.response,
          awaiting_plan_approval: result.awaiting_plan_approval,
          hint: result.hint,
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

  server.tool(
    "continue_session",
    describeTool("continue_session"),
    {
      session_id: z.string().uuid(),
      prompt: z
        .string()
        .optional()
        .describe("Obrigatório salvo com approve_plan/reject_plan"),
      model: z.string().optional(),
      agentic_mode: z.boolean().default(false),
      planner_mode: plannerModeSchema.describe(PLANNER_MODE_DESC),
      timeout_ms: z.number().default(120_000),
      include_context_pack: z.boolean().default(true),
      approve_plan: z
        .boolean()
        .optional()
        .describe(
          "Aprova o plano do Antigravity e pede implementação no mesmo cascade (agentic + PLANNING_OFF)",
        ),
      reject_plan: z
        .boolean()
        .optional()
        .describe("Rejeita o plano e pede para parar sem implementar"),
    },
    async (params) => {
      try {
        requireSupabase();
        const result = await continueSession({
          sessionId: params.session_id,
          prompt: params.prompt,
          model: params.model,
          agentic_mode: params.agentic_mode,
          planner_mode: params.planner_mode,
          timeout_ms: params.timeout_ms,
          include_context_pack: params.include_context_pack,
          approve_plan: params.approve_plan,
          reject_plan: params.reject_plan,
        });

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

  server.tool(
    "session_admin",
    describeTool("session_admin"),
    {
      action: z
        .enum(["get", "list", "add_context"])
        .describe("get = sessão + contexto; list = sessões do workspace; add_context = injeta contexto"),
      session_id: z.string().uuid().optional(),
      provider: z.enum(["antigravity", "cursor"]).optional(),
      limit: z.number().int().min(1).max(50).default(20),
      content: z.string().optional().describe("add_context: conteúdo a injetar"),
      label: z.string().optional(),
      content_type: z.string().default("text"),
      workspace_path: z.string().optional().describe(WORKSPACE_PATH_DESC),
    },
    async ({ action, session_id, provider, limit, content, label, content_type, workspace_path }) => {
      try {
        requireSupabase();

        if (action === "get") {
          if (!session_id) {
            return { ...jsonText({ success: false, message: "action=get exige session_id" }), isError: true };
          }
          const session = await getSession(session_id);
          if (!session) {
            return { ...jsonText({ success: false, message: "Sessão não encontrada" }), isError: true };
          }
          const context = await listSharedContext(session.workspace, session.id, 10);
          return jsonText({ success: true, session, context });
        }

        if (action === "list") {
          const sessions = await listSessions({
            workspace: resolveWorkspacePath(workspace_path),
            provider,
            limit,
          });
          return jsonText({ success: true, count: sessions.length, sessions });
        }

        if (!content) {
          return { ...jsonText({ success: false, message: "action=add_context exige content" }), isError: true };
        }
        const item = await addSharedContext({
          workspace: resolveWorkspacePath(workspace_path),
          sessionId: session_id,
          label,
          content,
          contentType: content_type,
        });
        return jsonText({ success: true, context: item });
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
