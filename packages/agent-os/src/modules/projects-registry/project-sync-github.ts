import { callChildTool } from "../mcp_hub/child-client/child-mcp-client.js";
import {
  getConnection,
  registerPresetMcps,
} from "../mcp_hub/registry/connection-store.js";
import { assembleProjectDocs } from "./project-docs-assembler.js";
import {
  getProjectById,
  getProjectBySlug,
  parseGithubUrl,
  upsertProject,
  type AgentProject,
} from "./project-store.js";

const GITHUB_ALIAS = "github";

function extractText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!Array.isArray(content)) return JSON.stringify(result);
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text ?? "")
    .join("\n");
}

async function ensureGithubConnection(): Promise<{ ok: true } | { ok: false; hint: string }> {
  let connection = await getConnection(GITHUB_ALIAS);
  if (!connection) {
    await registerPresetMcps();
    connection = await getConnection(GITHUB_ALIAS);
  }
  if (!connection) {
    return { ok: false, hint: "Preset github não encontrado. Use register_preset_mcps." };
  }
  return { ok: true };
}

async function tryChildTools(
  toolNames: string[],
  argsVariants: Record<string, unknown>[],
): Promise<{ text: string; tool: string } | null> {
  const connection = await getConnection(GITHUB_ALIAS);
  if (!connection) return null;

  for (const toolName of toolNames) {
    for (const args of argsVariants) {
      try {
        const result = await callChildTool(connection, toolName, args);
        const text = extractText(result).trim();
        if (text && !text.toLowerCase().includes("error")) {
          return { text, tool: toolName };
        }
      } catch {
        /* tenta próxima combinação */
      }
    }
  }
  return null;
}

async function resolveProject(idOrSlug: {
  id?: string;
  slug?: string;
}): Promise<AgentProject | null> {
  if (idOrSlug.id) return getProjectById(idOrSlug.id);
  if (idOrSlug.slug) return getProjectBySlug(idOrSlug.slug);
  return null;
}

export async function syncProjectFromGithub(input: {
  id?: string;
  slug?: string;
}): Promise<{
  ok: boolean;
  project?: AgentProject;
  hint?: string;
  syncedTool?: string;
}> {
  const ready = await ensureGithubConnection();
  if (!ready.ok) return ready;

  const project = await resolveProject(input);
  if (!project) return { ok: false, hint: "Projeto não encontrado." };

  const parsed =
    (project.github_owner && project.github_repo
      ? { owner: project.github_owner, repo: project.github_repo }
      : null) ?? (project.github_url ? parseGithubUrl(project.github_url) : null);

  if (!parsed) {
    return {
      ok: false,
      hint: "Defina github_url ou github_owner/github_repo antes do sync.",
    };
  }

  const readme = await tryChildTools(
    ["get_file_contents", "read_file"],
    [
      { owner: parsed.owner, repo: parsed.repo, path: "README.md" },
      { owner: parsed.owner, repo: parsed.repo, path: "readme.md" },
      { repository: `${parsed.owner}/${parsed.repo}`, path: "README.md" },
    ],
  );

  const readmeText = readme?.text ?? "";
  const docsMd = assembleProjectDocs(project, { githubReadme: readmeText });
  const now = new Date().toISOString();

  const updated = await upsertProject({
    id: project.id,
    github_owner: parsed.owner,
    github_repo: parsed.repo,
    github_url: project.github_url ?? `https://github.com/${parsed.owner}/${parsed.repo}`,
    docs_md: docsMd,
    readme_synced_at: now,
  });

  return {
    ok: true,
    project: updated,
    syncedTool: readme?.tool,
    hint: readme ? undefined : "GitHub conectado, mas README não encontrado via MCP.",
  };
}
