import * as fs from "node:fs";
import * as path from "node:path";
import { getSkillsRoot } from "../../config/paths.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../features/supabase-client.js";

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  version: string;
  scope: string;
  content_md: string;
  workspace_path: string | null;
}

const SKILLS_ROOT = getSkillsRoot();

function parseSkillMarkdown(
  content: string,
  fallbackName: string,
): { name: string; description: string } {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatter?.[1]) {
    const block = frontmatter[1];
    const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? fallbackName;
    const description =
      block.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? name;
    return { name, description };
  }

  const descriptionMatch = content.match(/^description:\s*(.+)$/m);
  return {
    name: fallbackName,
    description: descriptionMatch?.[1]?.trim() ?? fallbackName,
  };
}

function readLocalSkillDirs(skillsRoot = SKILLS_ROOT): Array<{
  name: string;
  description: string;
  content_md: string;
}> {
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }

  const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
  const skills: Array<{ name: string; description: string; content_md: string }> =
    [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillFile = path.join(skillsRoot, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      continue;
    }

    const content = fs.readFileSync(skillFile, "utf8");
    const parsed = parseSkillMarkdown(content, entry.name);
    skills.push({
      name: parsed.name,
      description: parsed.description,
      content_md: content,
    });
  }

  return skills;
}

function listLocalSkills(): SkillRecord[] {
  return readLocalSkillDirs().map((skill) => ({
    id: skill.name,
    name: skill.name,
    description: skill.description,
    version: "1.0.0",
    scope: "global",
    content_md: skill.content_md,
    workspace_path: null,
  }));
}

/** Sincroniza skills/ do monorepo para agent_skills no Supabase. */
export async function syncSkillsFromRepo(skillsRoot?: string): Promise<{
  synced: number;
  names: string[];
  skillsRoot: string;
}> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não configurado — defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  const root = skillsRoot ? path.resolve(skillsRoot) : SKILLS_ROOT;
  const local = readLocalSkillDirs(root);
  const names: string[] = [];

  for (const skill of local) {
    await upsertSkill({
      name: skill.name,
      description: skill.description,
      contentMd: skill.content_md,
      scope: "global",
    });
    names.push(skill.name);
  }

  return { synced: names.length, names, skillsRoot: root };
}

export async function listSkills(workspacePath?: string): Promise<SkillRecord[]> {
  const local = listLocalSkills();

  if (!isSupabaseConfigured()) {
    return local;
  }

  const client = getSupabaseClient();
  let query = client.from("agent_skills").select("*").order("name");

  if (workspacePath) {
    query = query.or(`scope.eq.global,workspace_path.eq.${path.resolve(workspacePath)}`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao listar skills: ${error.message}`);
  }

  const remote = (data ?? []) as SkillRecord[];
  const merged = new Map<string, SkillRecord>();
  for (const skill of [...local, ...remote]) {
    merged.set(`${skill.name}@${skill.version}`, skill);
  }

  return [...merged.values()];
}

export type ScoredSkill = SkillRecord & { score: number };

/** Ranking puro por overlap de tokens da intent com name+description. */
export function scoreSkillsByIntent(
  skills: SkillRecord[],
  intent: string,
): ScoredSkill[] {
  const tokens = intent
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  return skills
    .map((skill) => {
      const text = `${skill.name} ${skill.description}`.toLowerCase();
      const score = tokens.filter((token) => text.includes(token)).length;
      return { ...skill, score };
    })
    .sort((left, right) => right.score - left.score);
}

export async function resolveSkills(input: {
  intent: string;
  workspacePath?: string;
  limit?: number;
  /** Score mínimo para entrar no resultado (default 1: score 0 não preenche o limit). */
  minScore?: number;
}): Promise<ScoredSkill[]> {
  const skills = await listSkills(input.workspacePath);
  const minScore = input.minScore ?? 1;
  return scoreSkillsByIntent(skills, input.intent)
    .filter((skill) => skill.score >= minScore)
    .slice(0, input.limit ?? 3);
}

export async function upsertSkill(input: {
  name: string;
  description: string;
  contentMd: string;
  version?: string;
  scope?: string;
  workspacePath?: string;
}): Promise<SkillRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_skills")
    .upsert(
      {
        name: input.name,
        description: input.description,
        content_md: input.contentMd,
        version: input.version ?? "1.0.0",
        scope: input.scope ?? "global",
        workspace_path: input.workspacePath ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name,version" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao salvar skill: ${error.message}`);
  }

  return data as SkillRecord;
}

export async function getSkill(name: string, version = "1.0.0"): Promise<SkillRecord | null> {
  const skills = await listSkills();
  const found = skills.find((s) => s.name === name && s.version === version);
  return found ?? null;
}

export async function deleteSkill(name: string, version = "1.0.0"): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("agent_skills")
    .delete()
    .eq("name", name)
    .eq("version", version);
  if (error) throw new Error(`Falha ao deletar skill: ${error.message}`);
}

export async function bindSkillToProject(input: {
  skillId: string;
  workspacePath: string;
  priority?: number;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("agent_skill_bindings").insert({
    skill_id: input.skillId,
    workspace_path: input.workspacePath,
    priority: input.priority ?? 0,
  });
  if (error) throw new Error(`Falha ao vincular skill: ${error.message}`);
}

export async function listPlaybooks(options?: {
  includeHistory?: boolean;
}): Promise<
  Array<
    | { id: string; alias: string; server_id: string | null; created_at: string }
    | {
        alias: string;
        server_id: string | null;
        latest_version_at: string;
        version_count: number;
      }
  >
> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_playbooks")
    .select("id, alias, server_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao listar playbooks: ${error.message}`);

  const rows = data ?? [];
  if (options?.includeHistory) {
    return rows;
  }

  const grouped = new Map<
    string,
    { alias: string; server_id: string | null; latest_version_at: string; version_count: number }
  >();

  for (const row of rows) {
    const current = grouped.get(row.alias);
    if (!current) {
      grouped.set(row.alias, {
        alias: row.alias,
        server_id: row.server_id,
        latest_version_at: row.created_at,
        version_count: 1,
      });
      continue;
    }

    current.version_count += 1;
  }

  return [...grouped.values()].sort((left, right) =>
    right.latest_version_at.localeCompare(left.latest_version_at),
  );
}

export async function deletePlaybook(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("agent_playbooks").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar playbook: ${error.message}`);
}

export async function listProjectProfiles(): Promise<
  Array<{
    id: string;
    slug: string;
    title: string;
    workspace_path: string | null;
    stack_json: Record<string, unknown>;
    bundle_json: Record<string, unknown>;
    updated_at: string;
  }>
> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_projects")
    .select("id, slug, title, workspace_path, stack_json, bundle_json, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Falha ao listar projetos: ${error.message}`);
  return (data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    workspace_path: string | null;
    stack_json: Record<string, unknown>;
    bundle_json: Record<string, unknown>;
    updated_at: string;
  }>;
}

export function renderSkillForHost(
  skill: SkillRecord,
  host: "cursor" | "antigravity" | "claude_code",
): string {
  if (host === "cursor" || host === "antigravity") {
    return skill.content_md;
  }

  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.content_md}`;
}

export async function syncSkillsToHost(
  workspacePath: string,
  host: "cursor" = "cursor",
): Promise<{ written: string[] }> {
  const skills = await listSkills(workspacePath);
  const targetDir = path.join(workspacePath, ".cursor", "skills");

  fs.mkdirSync(targetDir, { recursive: true });
  const written: string[] = [];

  for (const skill of skills) {
    const skillDir = path.join(targetDir, skill.name);
    fs.mkdirSync(skillDir, { recursive: true });
    const filePath = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(filePath, renderSkillForHost(skill, host), "utf8");
    written.push(filePath);
  }

  return { written };
}

export async function getLatestPlaybook(aliasOrServerId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const client = getSupabaseClient();

  const { data: byAlias, error: aliasError } = await client
    .from("agent_playbooks")
    .select("content_md")
    .eq("alias", aliasOrServerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aliasError) {
    throw new Error(`Falha ao buscar playbook: ${aliasError.message}`);
  }

  if (byAlias?.content_md) {
    return byAlias.content_md as string;
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      aliasOrServerId,
    );

  if (!isUuid) {
    return null;
  }

  const serverAlias = `server-${aliasOrServerId.slice(0, 8)}`;
  const { data: byServer, error: serverError } = await client
    .from("agent_playbooks")
    .select("content_md")
    .or(`server_id.eq.${aliasOrServerId},alias.eq.${serverAlias}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (serverError) {
    throw new Error(`Falha ao buscar playbook por server: ${serverError.message}`);
  }

  return (byServer?.content_md as string | undefined) ?? null;
}

export async function updatePlaybook(input: {
  alias: string;
  contentMd: string;
  serverId?: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("agent_playbooks").insert({
    alias: input.alias,
    content_md: input.contentMd,
    server_id: input.serverId ?? null,
    author: "ai",
  });

  if (error) {
    throw new Error(`Falha ao salvar playbook: ${error.message}`);
  }
}

export async function detectKnowledgeDrift(input: {
  alias: string;
  currentOpenApiSummary: string;
}): Promise<{ driftDetected: boolean; suggestion: string }> {
  const playbook = await getLatestPlaybook(input.alias);
  if (!playbook) {
    return {
      driftDetected: true,
      suggestion: "Nenhum playbook encontrado. Crie um com update_playbook.",
    };
  }

  const playbookTokens = new Set(
    playbook.toLowerCase().split(/\W+/).filter((token) => token.length > 3),
  );
  const openApiTokens = input.currentOpenApiSummary
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);

  const overlap = openApiTokens.filter((token) => playbookTokens.has(token));
  const ratio = openApiTokens.length > 0 ? overlap.length / openApiTokens.length : 1;

  if (ratio < 0.2) {
    return {
      driftDetected: true,
      suggestion:
        "Playbook parece desatualizado em relação ao OpenAPI. Revise endpoints e atualize o playbook.",
    };
  }

  return {
    driftDetected: false,
    suggestion: "Playbook alinhado com o resumo OpenAPI fornecido.",
  };
}
