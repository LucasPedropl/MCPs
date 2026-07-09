import * as fs from "node:fs";
import * as path from "node:path";
import { getSupabaseClient } from "../../features/supabase-client.js";
import { slugify, titleFromWorkspacePath, withSlugSuffix } from "./slug.js";

export type ProjectType = "frontend" | "backend" | "fullstack";
export type ProjectStatus = "draft" | "published" | "archived";

export interface AgentProject {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  tags: string[];
  type: ProjectType;
  featured: boolean;
  cover_image_url: string | null;
  github_url: string | null;
  deploy_url: string | null;
  workspace_path: string | null;
  stack_json: Record<string, unknown>;
  bundle_json: Record<string, unknown>;
  docs_md: string;
  readme_synced_at: string | null;
  github_owner: string | null;
  github_repo: string | null;
  vercel_project_id: string | null;
  vercel_team_slug: string | null;
  status: ProjectStatus;
  portfolio_visible: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UpsertProjectInput {
  id?: string;
  slug?: string;
  title?: string;
  title_en?: string | null;
  description?: string;
  description_en?: string | null;
  tags?: string[];
  type?: ProjectType;
  featured?: boolean;
  cover_image_url?: string | null;
  github_url?: string | null;
  deploy_url?: string | null;
  workspace_path?: string | null;
  stack_json?: Record<string, unknown>;
  bundle_json?: Record<string, unknown>;
  docs_md?: string;
  readme_synced_at?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  vercel_project_id?: string | null;
  vercel_team_slug?: string | null;
  status?: ProjectStatus;
  portfolio_visible?: boolean;
  metadata_json?: Record<string, unknown>;
}

export interface ListProjectsFilters {
  status?: ProjectStatus;
  featured?: boolean;
  portfolio_visible?: boolean;
}

const COVER_BUCKET = "project-covers";
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function rowToProject(row: Record<string, unknown>): AgentProject {
  return row as unknown as AgentProject;
}

async function resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const client = getSupabaseClient();
  let candidate = slugify(base) || "project";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? candidate : withSlugSuffix(candidate, attempt);
    let query = client.from("agent_projects").select("id").eq("slug", slug);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Falha ao verificar slug: ${error.message}`);
    if (!data) return slug;
  }
  return `${candidate}-${Date.now()}`;
}

export async function listProjects(filters: ListProjectsFilters = {}): Promise<AgentProject[]> {
  const client = getSupabaseClient();
  let query = client.from("agent_projects").select("*").order("updated_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.featured !== undefined) query = query.eq("featured", filters.featured);
  if (filters.portfolio_visible !== undefined) {
    query = query.eq("portfolio_visible", filters.portfolio_visible);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar projetos: ${error.message}`);
  return (data ?? []).map((row) => rowToProject(row as Record<string, unknown>));
}

export async function getProjectById(id: string): Promise<AgentProject | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("agent_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao buscar projeto: ${error.message}`);
  return data ? rowToProject(data as Record<string, unknown>) : null;
}

export async function getProjectBySlug(slug: string): Promise<AgentProject | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("agent_projects").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Falha ao buscar projeto: ${error.message}`);
  return data ? rowToProject(data as Record<string, unknown>) : null;
}

export async function getProjectByWorkspace(workspacePath: string): Promise<AgentProject | null> {
  const client = getSupabaseClient();
  const resolved = path.resolve(workspacePath);
  const { data, error } = await client
    .from("agent_projects")
    .select("*")
    .eq("workspace_path", resolved)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar projeto: ${error.message}`);
  return data ? rowToProject(data as Record<string, unknown>) : null;
}

export async function upsertProject(input: UpsertProjectInput): Promise<AgentProject> {
  const client = getSupabaseClient();
  let existing: AgentProject | null = null;

  if (input.id) existing = await getProjectById(input.id);
  else if (input.slug) existing = await getProjectBySlug(input.slug);
  else if (input.workspace_path) existing = await getProjectByWorkspace(input.workspace_path);

  const slugBase =
    input.slug ??
    ((input.title ? slugify(input.title) : "") ||
      (input.workspace_path ? slugify(titleFromWorkspacePath(input.workspace_path)) : "") ||
      "project");

  const slug = existing?.slug ?? (await resolveUniqueSlug(slugBase, existing?.id));
  const title =
    input.title ??
    existing?.title ??
    (input.workspace_path ? titleFromWorkspacePath(input.workspace_path) : slug);

  const payload: Record<string, unknown> = {
    slug,
    title,
    title_en: input.title_en ?? existing?.title_en ?? null,
    description: input.description ?? existing?.description ?? "",
    description_en: input.description_en ?? existing?.description_en ?? null,
    tags: input.tags ?? existing?.tags ?? [],
    type: input.type ?? existing?.type ?? "fullstack",
    featured: input.featured ?? existing?.featured ?? false,
    cover_image_url: input.cover_image_url ?? existing?.cover_image_url ?? null,
    github_url: input.github_url ?? existing?.github_url ?? null,
    deploy_url: input.deploy_url ?? existing?.deploy_url ?? null,
    workspace_path: input.workspace_path
      ? path.resolve(input.workspace_path)
      : existing?.workspace_path ?? null,
    stack_json: input.stack_json ?? existing?.stack_json ?? {},
    bundle_json: input.bundle_json ?? existing?.bundle_json ?? {},
    docs_md: input.docs_md ?? existing?.docs_md ?? "",
    readme_synced_at: input.readme_synced_at ?? existing?.readme_synced_at ?? null,
    github_owner: input.github_owner ?? existing?.github_owner ?? null,
    github_repo: input.github_repo ?? existing?.github_repo ?? null,
    vercel_project_id: input.vercel_project_id ?? existing?.vercel_project_id ?? null,
    vercel_team_slug: input.vercel_team_slug ?? existing?.vercel_team_slug ?? null,
    status: input.status ?? existing?.status ?? "draft",
    portfolio_visible: input.portfolio_visible ?? existing?.portfolio_visible ?? true,
    metadata_json: input.metadata_json ?? existing?.metadata_json ?? {},
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await client
      .from("agent_projects")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(`Falha ao atualizar projeto: ${error?.message}`);
    return rowToProject(data as Record<string, unknown>);
  }

  const { data, error } = await client.from("agent_projects").insert([payload]).select("*").single();
  if (error || !data) throw new Error(`Falha ao criar projeto: ${error?.message}`);
  return rowToProject(data as Record<string, unknown>);
}

export async function deleteProject(id: string, removeCover = false): Promise<void> {
  const project = await getProjectById(id);
  if (!project) throw new Error(`Projeto ${id} não encontrado.`);

  const client = getSupabaseClient();
  const { error } = await client.from("agent_projects").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar projeto: ${error.message}`);

  if (removeCover && project.cover_image_url?.includes(COVER_BUCKET)) {
    const objectPath = project.cover_image_url.split(`${COVER_BUCKET}/`).pop();
    if (objectPath) {
      await client.storage.from(COVER_BUCKET).remove([objectPath]);
    }
  }
}

function detectMime(buffer: Buffer): string | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer.subarray(0, 4).toString("utf8") === "RIFF") return "image/webp";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  return null;
}

export async function uploadProjectCover(input: {
  projectId?: string;
  slug?: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
}): Promise<{ cover_image_url: string; project: AgentProject }> {
  const project =
    (input.projectId ? await getProjectById(input.projectId) : null) ??
    (input.slug ? await getProjectBySlug(input.slug) : null);
  if (!project) throw new Error("Projeto não encontrado para upload de capa.");

  let buffer: Buffer;
  let mimeType = input.mimeType ?? "image/png";

  if (input.filePath) {
    const resolved = path.resolve(input.filePath);
    if (!fs.existsSync(resolved)) throw new Error(`Arquivo não encontrado: ${resolved}`);
    buffer = fs.readFileSync(resolved);
    mimeType = detectMime(buffer) ?? mimeType;
  } else if (input.base64) {
    buffer = Buffer.from(input.base64, "base64");
    mimeType = detectMime(buffer) ?? mimeType;
  } else {
    throw new Error("Informe file_path ou base64.");
  }

  if (buffer.length > MAX_COVER_BYTES) {
    throw new Error("Imagem excede 5MB.");
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(`MIME não permitido: ${mimeType}`);
  }

  const ext = mimeType.split("/")[1] ?? "png";
  const objectPath = `${project.slug}/cover.${ext}`;
  const client = getSupabaseClient();
  const { error: uploadError } = await client.storage
    .from(COVER_BUCKET)
    .upload(objectPath, buffer, { contentType: mimeType, upsert: true });
  if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);

  const { data: publicData } = client.storage.from(COVER_BUCKET).getPublicUrl(objectPath);
  const coverUrl = publicData.publicUrl;

  const updated = await upsertProject({
    id: project.id,
    cover_image_url: coverUrl,
  });

  return { cover_image_url: coverUrl, project: updated };
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}
