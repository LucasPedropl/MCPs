import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorText, jsonText } from "@mcps/shared";
import { upsertPreference } from "../modules/memory/memory-store.js";
import { invalidateContextCache } from "../modules/context/context-assembler.js";
import { upsertPolicy, type PolicyRecord } from "../modules/policy/policy-store.js";
import { isSupabaseConfigured } from "../features/supabase-client.js";
import { describeAgentTool } from "./tool-docs.js";

function slugifyRule(rule: string): string {
  return rule
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/**
 * Tool unificada para regras de projeto: grava preferência project-scoped
 * (aparece no assemble_context) e, se enforce=true, cria policy deny que é
 * aplicada nas delegações e nos hooks do Cursor.
 */
export function registerSetProjectRule(server: McpServer): void {
  server.registerTool(
    "set_project_rule",
    {
      description: describeAgentTool("set_project_rule"),
      inputSchema: {
        workspace_path: z.string().min(1),
        rule: z.string().min(1).describe("Texto da regra, ex: 'API é somente leitura'"),
        key: z.string().optional().describe("Chave da preferência (default: rule:<slug>)"),
        priority: z.number().optional().describe("Default 100"),
        enforce: z
          .boolean()
          .optional()
          .describe("Se true, cria policy deny com action_pattern"),
        action_pattern: z
          .string()
          .optional()
          .describe("Pattern da ação a bloquear, ex: 'write:apps/meu-app/api/**'"),
      },
    },
    async (args) => {
      if (!isSupabaseConfigured()) {
        return errorText("Supabase não configurado — impossível gravar regra.");
      }

      const workspace = path.resolve(args.workspace_path);
      const key = args.key ?? `rule:${slugifyRule(args.rule)}`;
      const priority = args.priority ?? 100;

      const preference = await upsertPreference({
        key,
        value: { rule: args.rule, enforced: Boolean(args.enforce) },
        scope: "project",
        workspacePath: workspace,
        priority,
      });

      let policy: PolicyRecord | null = null;
      const warnings: string[] = [];

      if (args.enforce) {
        if (!args.action_pattern) {
          warnings.push(
            "enforce=true sem action_pattern — policy NÃO criada. Informe action_pattern (ex: 'write:apps/x/api/**').",
          );
        } else {
          policy = await upsertPolicy({
            intent: "*",
            actionPattern: args.action_pattern,
            rule: { effect: "deny", reason: args.rule },
            enabled: true,
          });
        }
      }

      invalidateContextCache();

      return jsonText({
        preference: { id: preference.id, key, scope: "project", workspace },
        policy: policy
          ? { id: policy.id, action_pattern: policy.action_pattern, effect: "deny" }
          : null,
        applied_via: [
          "assemble_context / recall_for_task no workspace (preferência project-scoped)",
          ...(policy
            ? [
                "check_policy + delegações (deny automático)",
                "hooks do Cursor, se instalados (bloqueio real de write/shell)",
              ]
            : []),
        ],
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    },
  );
}
