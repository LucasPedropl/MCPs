import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorText, jsonText } from "@mcps/shared";
import { assembleProjectDocs } from "../modules/projects-registry/project-docs-assembler.js";
import {
  deleteProject,
  getProjectById,
  getProjectBySlug,
  listProjects,
  uploadProjectCover,
  upsertProject,
} from "../modules/projects-registry/project-store.js";
import { syncProjectFromGithub } from "../modules/projects-registry/project-sync-github.js";
import { syncProjectFromVercel } from "../modules/projects-registry/project-sync-vercel.js";
import { describeAgentTool } from "./tool-docs.js";

const projectTypeSchema = z.enum(["frontend", "backend", "fullstack"]);
const projectStatusSchema = z.enum(["draft", "published", "archived"]);

type SyncProjectArgs = {
  target: "github" | "vercel" | "docs" | "cover";
  id?: string;
  slug?: string;
  save?: boolean;
  file_path?: string;
  base64?: string;
  mime_type?: string;
};

async function handleSyncProject(args: SyncProjectArgs) {
  if (args.target === "github") {
    return jsonText(await syncProjectFromGithub({ id: args.id, slug: args.slug }));
  }

  if (args.target === "vercel") {
    return jsonText(await syncProjectFromVercel({ id: args.id, slug: args.slug }));
  }

  if (args.target === "cover") {
    return jsonText(
      await uploadProjectCover({
        projectId: args.id,
        slug: args.slug,
        filePath: args.file_path,
        base64: args.base64,
        mimeType: args.mime_type,
      }),
    );
  }

  // docs
  const project =
    (args.id ? await getProjectById(args.id) : null) ??
    (args.slug ? await getProjectBySlug(args.slug) : null);
  if (!project) {
    return errorText("Projeto não encontrado.");
  }
  const docs = assembleProjectDocs(project);
  if (args.save) {
    const updated = await upsertProject({ id: project.id, docs_md: docs });
    return jsonText({ docs_md: docs, project: updated });
  }
  return jsonText({ docs_md: docs });
}

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    "list_agent_projects",
    {
      description: describeAgentTool("list_agent_projects"),
      inputSchema: {
        status: projectStatusSchema.optional(),
        featured: z.boolean().optional(),
        portfolio_visible: z.boolean().optional(),
      },
    },
    async (args) =>
      jsonText(
        await listProjects({
          status: args.status,
          featured: args.featured,
          portfolio_visible: args.portfolio_visible,
        }),
      ),
  );

  server.registerTool(
    "get_project",
    {
      description: describeAgentTool("get_project"),
      inputSchema: {
        id: z.string().optional(),
        slug: z.string().optional(),
      },
    },
    async (args) => {
      const project =
        (args.id ? await getProjectById(args.id) : null) ??
        (args.slug ? await getProjectBySlug(args.slug) : null);
      return jsonText(project);
    },
  );

  server.registerTool(
    "upsert_project",
    {
      description: describeAgentTool("upsert_project"),
      inputSchema: {
        id: z.string().optional(),
        slug: z.string().optional(),
        title: z.string().optional(),
        title_en: z.string().optional(),
        description: z.string().optional(),
        description_en: z.string().optional(),
        tags: z.array(z.string()).optional(),
        type: projectTypeSchema.optional(),
        featured: z.boolean().optional(),
        cover_image_url: z.string().optional(),
        github_url: z.string().optional(),
        deploy_url: z.string().optional(),
        workspace_path: z.string().optional(),
        stack_json: z.record(z.unknown()).optional(),
        bundle_json: z.record(z.unknown()).optional(),
        docs_md: z.string().optional(),
        github_owner: z.string().optional(),
        github_repo: z.string().optional(),
        vercel_project_id: z.string().optional(),
        vercel_team_slug: z.string().optional(),
        status: projectStatusSchema.optional(),
        portfolio_visible: z.boolean().optional(),
        metadata_json: z.record(z.unknown()).optional(),
      },
    },
    async (args) => jsonText(await upsertProject(args)),
  );

  server.registerTool(
    "delete_project",
    {
      description: describeAgentTool("delete_project"),
      inputSchema: {
        id: z.string(),
        remove_cover: z.boolean().optional(),
      },
    },
    async (args) => {
      await deleteProject(args.id, args.remove_cover ?? false);
      return jsonText({ ok: true });
    },
  );

  server.registerTool(
    "sync_project",
    {
      description: describeAgentTool("sync_project"),
      inputSchema: {
        target: z.enum(["github", "vercel", "docs", "cover"]),
        id: z.string().optional(),
        slug: z.string().optional(),
        save: z.boolean().optional().describe("docs: persiste docs_md no projeto"),
        file_path: z.string().optional().describe("cover: caminho local da imagem"),
        base64: z.string().optional().describe("cover: imagem base64"),
        mime_type: z.string().optional(),
      },
    },
    async (args) => handleSyncProject(args as SyncProjectArgs),
  );
}
