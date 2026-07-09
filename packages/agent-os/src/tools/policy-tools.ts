import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorText, jsonText } from "@mcps/shared";
import {
  checkPolicy,
  deletePolicy,
  listPolicies,
  upsertPolicy,
} from "../modules/policy/policy-store.js";
import { describeAgentTool } from "./tool-docs.js";

const policyRuleSchema = z.object({
  effect: z.enum(["allow", "deny"]),
  reason: z.string().optional(),
});

export function registerPolicyTools(server: McpServer): void {
  server.registerTool(
    "upsert_policy",
    {
      description: describeAgentTool("upsert_policy"),
      inputSchema: {
        id: z.string().uuid().optional(),
        intent: z.string().min(1).describe("Pattern do intent ('*' para qualquer)"),
        action_pattern: z
          .string()
          .min(1)
          .describe("Pattern da action, ex: 'write:apps/x/api/**' (glob), regex ou substring"),
        rule: policyRuleSchema,
        enabled: z.boolean().optional(),
      },
    },
    async (args) => {
      const policy = await upsertPolicy({
        id: args.id,
        intent: args.intent,
        actionPattern: args.action_pattern,
        rule: args.rule,
        enabled: args.enabled,
      });
      return jsonText(policy);
    },
  );

  server.registerTool(
    "check_policy",
    {
      description: describeAgentTool("check_policy"),
      inputSchema: {
        intent: z.string().min(1),
        action: z.string().min(1).describe("Ex: 'write:apps/x/api/rota.ts', 'delegate_task:cursor'"),
      },
    },
    async (args) => jsonText(await checkPolicy({ intent: args.intent, action: args.action })),
  );

  server.registerTool(
    "policy_admin",
    {
      description: describeAgentTool("policy_admin"),
      inputSchema: {
        action: z.enum(["list", "delete", "toggle"]),
        id: z.string().uuid().optional(),
        enabled: z.boolean().optional().describe("toggle: novo estado"),
      },
    },
    async (args) => {
      if (args.action === "list") {
        return jsonText(await listPolicies());
      }

      if (!args.id) {
        return errorText(`action=${args.action} exige 'id'.`);
      }

      if (args.action === "delete") {
        await deletePolicy(args.id);
        return jsonText({ ok: true });
      }

      // toggle: reusa upsert preservando dados
      const policies = await listPolicies();
      const existing = policies.find((policy) => policy.id === args.id);
      if (!existing) {
        return errorText(`Policy '${args.id}' não encontrada.`);
      }
      const updated = await upsertPolicy({
        id: existing.id,
        intent: existing.intent,
        actionPattern: existing.action_pattern,
        rule: existing.rule,
        enabled: args.enabled ?? !existing.enabled,
      });
      return jsonText(updated);
    },
  );
}
