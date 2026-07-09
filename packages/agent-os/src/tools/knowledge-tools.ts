import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorText, jsonText } from "@mcps/shared";
import {
  bindSkillToProject,
  deletePlaybook,
  deleteSkill,
  detectKnowledgeDrift,
  getLatestPlaybook,
  getSkill,
  listPlaybooks,
  listSkills,
  resolveSkills,
  syncSkillsToHost,
  syncSkillsFromRepo,
  updatePlaybook,
  upsertSkill,
} from "../modules/knowledge/knowledge-store.js";
import { describeAgentTool } from "./tool-docs.js";

type SkillAdminArgs = {
  action: "list" | "upsert" | "delete" | "bind_to_project";
  name?: string;
  description?: string;
  content_md?: string;
  version?: string;
  scope?: string;
  skill_id?: string;
  priority?: number;
  workspace_path?: string;
};

async function handleSkillAdmin(args: SkillAdminArgs) {
  if (args.action === "list") {
    return jsonText(await listSkills(args.workspace_path));
  }

  if (args.action === "upsert") {
    if (!args.name || !args.description || !args.content_md) {
      return errorText("action=upsert exige 'name', 'description' e 'content_md'.");
    }
    return jsonText(
      await upsertSkill({
        name: args.name,
        description: args.description,
        contentMd: args.content_md,
        version: args.version,
        scope: args.scope,
        workspacePath: args.workspace_path,
      }),
    );
  }

  if (args.action === "delete") {
    if (!args.name) return errorText("action=delete exige 'name'.");
    await deleteSkill(args.name, args.version);
    return jsonText({ ok: true });
  }

  if (!args.skill_id || !args.workspace_path) {
    return errorText("action=bind_to_project exige 'skill_id' e 'workspace_path'.");
  }
  await bindSkillToProject({
    skillId: args.skill_id,
    workspacePath: args.workspace_path,
    priority: args.priority,
  });
  return jsonText({ ok: true });
}

type PlaybookArgs = {
  action: "get" | "list" | "update" | "delete" | "detect_drift";
  alias?: string;
  content_md?: string;
  server_id?: string;
  id?: string;
  current_openapi_summary?: string;
};

async function handlePlaybook(args: PlaybookArgs) {
  if (args.action === "list") {
    return jsonText(await listPlaybooks());
  }

  if (args.action === "get") {
    if (!args.alias) return errorText("action=get exige 'alias'.");
    return jsonText({ content: await getLatestPlaybook(args.alias) });
  }

  if (args.action === "update") {
    if (!args.alias || !args.content_md) {
      return errorText("action=update exige 'alias' e 'content_md'.");
    }
    await updatePlaybook({
      alias: args.alias,
      contentMd: args.content_md,
      serverId: args.server_id,
    });
    return jsonText({ ok: true });
  }

  if (args.action === "delete") {
    if (!args.id) return errorText("action=delete exige 'id'.");
    await deletePlaybook(args.id);
    return jsonText({ ok: true });
  }

  if (!args.alias || !args.current_openapi_summary) {
    return errorText("action=detect_drift exige 'alias' e 'current_openapi_summary'.");
  }
  return jsonText(
    await detectKnowledgeDrift({
      alias: args.alias,
      currentOpenApiSummary: args.current_openapi_summary,
    }),
  );
}

export function registerKnowledgeTools(server: McpServer): void {
  server.registerTool(
    "resolve_skills",
    {
      description: describeAgentTool("resolve_skills"),
      inputSchema: {
        intent: z.string(),
        workspace_path: z.string().optional(),
        limit: z.number().optional(),
      },
    },
    async (args) =>
      jsonText(
        await resolveSkills({
          intent: args.intent,
          workspacePath: args.workspace_path,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "get_skill",
    {
      description: describeAgentTool("get_skill"),
      inputSchema: { name: z.string(), version: z.string().optional() },
    },
    async (args) => jsonText(await getSkill(args.name, args.version)),
  );

  server.registerTool(
    "sync_skills",
    {
      description: describeAgentTool("sync_skills"),
      inputSchema: {
        direction: z.enum(["from_repo", "to_host"]),
        skills_root: z.string().optional().describe("from_repo: raiz de skills/ do monorepo"),
        workspace_path: z.string().optional().describe("to_host: workspace destino"),
      },
    },
    async (args) => {
      if (args.direction === "from_repo") {
        return jsonText(await syncSkillsFromRepo(args.skills_root));
      }
      if (!args.workspace_path) {
        return errorText("direction=to_host exige 'workspace_path'.");
      }
      return jsonText(await syncSkillsToHost(args.workspace_path));
    },
  );

  server.registerTool(
    "skill_admin",
    {
      description: describeAgentTool("skill_admin"),
      inputSchema: {
        action: z.enum(["list", "upsert", "delete", "bind_to_project"]),
        name: z.string().optional(),
        description: z.string().optional(),
        content_md: z.string().optional(),
        version: z.string().optional(),
        scope: z.string().optional(),
        skill_id: z.string().optional(),
        priority: z.number().optional(),
        workspace_path: z.string().optional(),
      },
    },
    async (args) => handleSkillAdmin(args as SkillAdminArgs),
  );

  server.registerTool(
    "playbook",
    {
      description: describeAgentTool("playbook"),
      inputSchema: {
        action: z.enum(["get", "list", "update", "delete", "detect_drift"]),
        alias: z.string().optional(),
        content_md: z.string().optional(),
        server_id: z.string().optional(),
        id: z.string().optional(),
        current_openapi_summary: z.string().optional(),
      },
    },
    async (args) => handlePlaybook(args as PlaybookArgs),
  );
}
