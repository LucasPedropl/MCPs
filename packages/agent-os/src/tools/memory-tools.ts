import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorText, jsonText } from "@mcps/shared";
import {
  deleteDecision,
  deletePitfall,
  deletePreference,
  getChangesSince,
  listDecisions,
  listPitfalls,
  listPreferences,
  logTask,
  recallMemory,
  saveDecision,
  savePitfall,
  updateDecision,
  upsertPreference,
} from "../modules/memory/memory-store.js";
import { slimMemoryRecall } from "../modules/memory/memory-slim.js";
import { invalidateContextCache } from "../modules/context/context-assembler.js";
import { importRulesFromWorkspace } from "../modules/memory/memory-seed.js";
import { isSupabaseConfigured } from "../features/supabase-client.js";
import { describeAgentTool } from "./tool-docs.js";
import { registerSetProjectRule } from "./set-project-rule.js";

type RememberArgs = {
  kind: "preference" | "decision" | "pitfall" | "task_log";
  key?: string;
  value?: Record<string, unknown>;
  scope?: "global" | "project";
  priority?: number;
  topic?: string;
  chosen_option?: string;
  problem?: string;
  rationale?: string;
  links?: string[];
  symptom?: string;
  fix?: string;
  root_cause?: string;
  tags?: string[];
  task_id?: string;
  summary?: string;
  outcome?: string;
  host?: string;
  provider?: string;
  artifacts?: Record<string, unknown>;
  project?: string;
  workspace_path?: string;
};

async function handleRemember(args: RememberArgs) {
  // Memória nova deve aparecer no próximo assemble_context, não após o TTL.
  invalidateContextCache();

  if (args.kind === "preference") {
    if (!args.key || !args.value) {
      return errorText("kind=preference exige 'key' e 'value'.");
    }
    return jsonText(
      await upsertPreference({
        key: args.key,
        value: args.value,
        scope: args.scope ?? "global",
        workspacePath: args.workspace_path,
        priority: args.priority,
      }),
    );
  }

  if (args.kind === "decision") {
    if (!args.topic || !args.chosen_option) {
      return errorText("kind=decision exige 'topic' e 'chosen_option'.");
    }
    return jsonText(
      await saveDecision({
        topic: args.topic,
        chosenOption: args.chosen_option,
        project: args.project,
        problem: args.problem,
        rationale: args.rationale,
        links: args.links,
        workspacePath: args.workspace_path,
      }),
    );
  }

  if (args.kind === "pitfall") {
    if (!args.symptom || !args.fix) {
      return errorText("kind=pitfall exige 'symptom' e 'fix'.");
    }
    return jsonText(
      await savePitfall({
        symptom: args.symptom,
        fix: args.fix,
        project: args.project,
        rootCause: args.root_cause,
        tags: args.tags,
        workspacePath: args.workspace_path,
      }),
    );
  }

  if (!args.task_id || !args.summary || !args.outcome) {
    return errorText("kind=task_log exige 'task_id', 'summary' e 'outcome'.");
  }
  return jsonText(
    await logTask({
      taskId: args.task_id,
      summary: args.summary,
      outcome: args.outcome,
      host: args.host,
      provider: args.provider,
      workspacePath: args.workspace_path,
      artifacts: args.artifacts,
    }),
  );
}

type MemoryAdminArgs = {
  action: "list" | "update" | "delete" | "changes_since";
  kind?: "preference" | "decision" | "pitfall";
  id?: string;
  key?: string;
  scope?: "global" | "project";
  project?: string;
  workspace_path?: string;
  limit?: number;
  since?: string;
  task_id?: string;
  rationale?: string;
  links?: string[];
  chosen_option?: string;
};

async function handleMemoryAdmin(args: MemoryAdminArgs) {
  if (args.action === "changes_since") {
    return jsonText(
      await getChangesSince({
        since: args.since,
        taskId: args.task_id,
        workspacePath: args.workspace_path,
      }),
    );
  }

  if (!args.kind) {
    return errorText(`action=${args.action} exige 'kind' (preference|decision|pitfall).`);
  }

  if (args.action === "list") {
    if (args.kind === "preference") {
      return jsonText(await listPreferences(args.workspace_path));
    }
    const filters = {
      project: args.project,
      workspacePath: args.workspace_path,
      limit: args.limit,
    };
    return jsonText(
      args.kind === "decision" ? await listDecisions(filters) : await listPitfalls(filters),
    );
  }

  if (args.action === "update") {
    if (args.kind !== "decision" || !args.id) {
      return errorText("action=update suporta apenas kind=decision com 'id'.");
    }
    return jsonText(
      await updateDecision(args.id, {
        rationale: args.rationale,
        links: args.links,
        chosen_option: args.chosen_option,
      }),
    );
  }

  // delete
  if (args.kind === "preference") {
    await deletePreference({
      id: args.id,
      key: args.key,
      scope: args.scope,
      workspacePath: args.workspace_path,
    });
  } else if (args.kind === "decision") {
    if (!args.id) return errorText("delete de decision exige 'id'.");
    await deleteDecision(args.id);
  } else {
    if (!args.id) return errorText("delete de pitfall exige 'id'.");
    await deletePitfall(args.id);
  }
  return jsonText({ ok: true });
}

export function registerMemoryTools(server: McpServer): void {
  server.registerTool(
    "remember",
    {
      description: describeAgentTool("remember"),
      inputSchema: {
        kind: z.enum(["preference", "decision", "pitfall", "task_log"]),
        key: z.string().optional().describe("preference: chave única"),
        value: z.record(z.unknown()).optional().describe("preference: valor JSON"),
        scope: z.enum(["global", "project"]).optional(),
        priority: z.number().optional(),
        topic: z.string().optional().describe("decision: tema da decisão"),
        chosen_option: z.string().optional().describe("decision: opção escolhida"),
        problem: z.string().optional(),
        rationale: z.string().optional(),
        links: z.array(z.string()).optional(),
        symptom: z.string().optional().describe("pitfall: sintoma do erro"),
        fix: z.string().optional().describe("pitfall: como resolver/evitar"),
        root_cause: z.string().optional(),
        tags: z.array(z.string()).optional(),
        task_id: z.string().optional().describe("task_log: id da tarefa"),
        summary: z.string().optional().describe("task_log: resumo"),
        outcome: z.string().optional().describe("task_log: resultado"),
        host: z.string().optional(),
        provider: z.string().optional(),
        artifacts: z.record(z.unknown()).optional(),
        project: z.string().optional(),
        workspace_path: z.string().optional(),
      },
    },
    async (args) => {
      if (!isSupabaseConfigured()) {
        return errorText("Supabase não configurado.");
      }
      return handleRemember(args as RememberArgs);
    },
  );

  server.registerTool(
    "recall_for_task",
    {
      description: describeAgentTool("recall_for_task"),
      inputSchema: {
        intent: z.string(),
        workspace_path: z.string().optional(),
        limit: z.number().optional(),
        raw: z.boolean().optional().describe("Se true, retorna rows completas do banco"),
      },
    },
    async (args) => {
      const memory = await recallMemory({
        intent: args.intent,
        workspacePath: args.workspace_path,
        limit: args.limit,
      });

      if (args.raw) {
        return jsonText(memory);
      }

      return jsonText(slimMemoryRecall(memory));
    },
  );

  server.registerTool(
    "memory_admin",
    {
      description: describeAgentTool("memory_admin"),
      inputSchema: {
        action: z.enum(["list", "update", "delete", "changes_since"]),
        kind: z.enum(["preference", "decision", "pitfall"]).optional(),
        id: z.string().optional(),
        key: z.string().optional(),
        scope: z.enum(["global", "project"]).optional(),
        project: z.string().optional(),
        workspace_path: z.string().optional(),
        limit: z.number().optional(),
        since: z.string().optional().describe("changes_since: data ISO"),
        task_id: z.string().optional().describe("changes_since: task de referência"),
        rationale: z.string().optional(),
        links: z.array(z.string()).optional(),
        chosen_option: z.string().optional(),
      },
    },
    async (args) => handleMemoryAdmin(args as MemoryAdminArgs),
  );

  server.registerTool(
    "import_from_rules",
    {
      description: describeAgentTool("import_from_rules"),
      inputSchema: {
        workspace_path: z.string(),
      },
    },
    async (args) => {
      const result: Record<string, unknown> = {};
      const imported = await importRulesFromWorkspace(args.workspace_path);
      result["imported"] = imported;

      const truncatedFiles = imported.sources.filter((source) => source.truncated);
      if (truncatedFiles.length > 0) {
        result["truncated_files"] = truncatedFiles.map((source) => ({
          source: source.source,
          original_chars: source.originalChars,
          imported_chars: source.importedChars,
        }));
        result["hint"] =
          `${truncatedFiles.length} arquivo(s) excederam 4000 chars e foram importados parcialmente — ` +
          "considere dividir a regra ou registrá-la como skill (sync_skills).";
      }

      return jsonText(result);
    },
  );

  registerSetProjectRule(server);
}
