import { callChildTool } from "../mcp_hub/child-client/child-mcp-client.js";
import {
  getConnection,
  registerPresetMcps,
} from "../mcp_hub/registry/connection-store.js";
import { assembleProjectDocs } from "./project-docs-assembler.js";
import {
  getProjectById,
  getProjectBySlug,
  upsertProject,
  type AgentProject,
} from "./project-store.js";

const VERCEL_ALIAS = "vercel";

function extractText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!Array.isArray(content)) return JSON.stringify(result);
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text ?? "")
    .join("\n");
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function findDeployUrl(payload: unknown, projectName: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.url === "string") return record.url;
  if (typeof record.deploymentUrl === "string") return record.deploymentUrl;

  const arrays = ["projects", "deployments", "items", "data"];
  for (const key of arrays) {
    const list = record[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const name = String(entry.name ?? entry.projectName ?? "");
      const url = entry.url ?? entry.deploymentUrl ?? entry.productionUrl;
      if (typeof url === "string" && (!projectName || name.includes(projectName) || projectName.includes(name))) {
        return url;
      }
    }
  }
  return null;
}

async function ensureVercelConnection(): Promise<{ ok: true } | { ok: false; hint: string }> {
  let connection = await getConnection(VERCEL_ALIAS);
  if (!connection) {
    await registerPresetMcps();
    connection = await getConnection(VERCEL_ALIAS);
  }
  if (!connection) {
    return { ok: false, hint: "Preset vercel não encontrado. Use register_preset_mcps." };
  }
  return { ok: true };
}

async function resolveProject(idOrSlug: {
  id?: string;
  slug?: string;
}): Promise<AgentProject | null> {
  if (idOrSlug.id) return getProjectById(idOrSlug.id);
  if (idOrSlug.slug) return getProjectBySlug(idOrSlug.slug);
  return null;
}

export async function syncProjectFromVercel(input: {
  id?: string;
  slug?: string;
}): Promise<{
  ok: boolean;
  project?: AgentProject;
  hint?: string;
  syncedTool?: string;
}> {
  const ready = await ensureVercelConnection();
  if (!ready.ok) return ready;

  const project = await resolveProject(input);
  if (!project) return { ok: false, hint: "Projeto não encontrado." };

  const connection = await getConnection(VERCEL_ALIAS);
  if (!connection) return { ok: false, hint: "Conexão vercel indisponível." };

  const matchName = project.vercel_project_id ?? project.slug ?? project.title;
  const toolCandidates = ["list_projects", "list_deployments", "get_project"];
  let deployUrl: string | null = null;
  let vercelProjectId = project.vercel_project_id;
  let syncedTool: string | undefined;
  let vercelNote = "";

  for (const toolName of toolCandidates) {
    try {
      const result = await callChildTool(connection, toolName, {
        projectId: project.vercel_project_id ?? undefined,
        projectName: matchName,
        teamId: project.vercel_team_slug ?? undefined,
      });
      const text = extractText(result);
      vercelNote = text.slice(0, 4000);
      const parsed = parseJsonText(text);
      deployUrl = findDeployUrl(parsed, matchName);
      syncedTool = toolName;
      if (deployUrl) break;
    } catch {
      /* próxima tool */
    }
  }

  if (!deployUrl && !vercelNote) {
    return {
      ok: false,
      hint: "Vercel conectado, mas nenhum deploy encontrado. Verifique VERCEL_TOKEN.",
    };
  }

  const docsMd = assembleProjectDocs(project, {
    vercelNote: vercelNote || `Deploy: ${deployUrl ?? "não detectado"}`,
  });

  const updated = await upsertProject({
    id: project.id,
    deploy_url: deployUrl ?? project.deploy_url,
    vercel_project_id: vercelProjectId,
    docs_md: docsMd,
  });

  return {
    ok: true,
    project: updated,
    syncedTool,
    hint: deployUrl ? undefined : "Sync parcial — docs Vercel salvos, URL não detectada.",
  };
}
