import * as fs from "node:fs";
import * as path from "node:path";
import { getSupabaseClient, isSupabaseConfigured } from "../../features/supabase-client.js";
import { titleFromWorkspacePath } from "../projects-registry/slug.js";
import { upsertProject } from "../projects-registry/project-store.js";
import { detectStack } from "./bootstrap-detect.js";
export interface ProjectProfile {
  workspace_path: string;
  stack_json: Record<string, unknown>;
  bundle_json: Record<string, unknown>;
  updated_at: string;
}

function buildRecommendedBundle(stack: Record<string, unknown>): Record<string, unknown> {
  const skills: string[] = ["pedro-defaults"];
  const tools: string[] = [
    "bootstrap_project",
    "assemble_context",
    "recall_for_task",
    "route_for_pedro",
  ];

  if (stack["supabase"]) {
    skills.push("supabase-workflows");
    tools.push("switch_project", "execute_sql", "schema_context_for_task");
  }

  if (stack["next"]) {
    skills.push("nextjs-patterns");
  }

  tools.push("list_connected_mcps", "call_mcp_tool", "run_quality_gates");

  return { skills, tools, mcp_presets: ["github", "vercel"] };
}

function isRlsError(message: string): boolean {
  return /row-level security|violates row-level|permission denied|42501/i.test(message);
}

export async function bootstrapWorkspace(
  workspacePath: string,
): Promise<ProjectProfile & { detected: Record<string, unknown>; warnings?: string[] }> {
  const resolved = path.resolve(workspacePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Workspace não existe: ${resolved}`);
  }

  const stack = detectStack(resolved);
  const bundle = buildRecommendedBundle(stack);

  const profile: ProjectProfile = {
    workspace_path: resolved,
    stack_json: stack,
    bundle_json: bundle,
    updated_at: new Date().toISOString(),
  };

  const warnings: string[] = [];

  if (isSupabaseConfigured()) {
    try {
      await upsertProject({
        workspace_path: resolved,
        stack_json: stack,
        bundle_json: bundle,
        title: titleFromWorkspacePath(resolved),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isRlsError(message)) {
        warnings.push(
          "Perfil NÃO persistido em agent_projects: a key atual não tem permissão de escrita (RLS). " +
            "Use a service_role key em AGENT_OS_SUPABASE_KEY para persistir perfis. " +
            "O bootstrap continua válido localmente nesta resposta.",
        );
      } else {
        warnings.push(`Falha ao persistir perfil em agent_projects: ${message}`);
      }
      console.error(`[bootstrap_project] upsertProject falhou: ${message}`);
    }
  } else {
    warnings.push("Supabase não configurado — perfil não persistido.");
  }

  return {
    ...profile,
    detected: stack,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function getProjectProfile(
  workspacePath: string,
): Promise<ProjectProfile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_projects")
    .select("*")
    .eq("workspace_path", path.resolve(workspacePath))
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar perfil: ${error.message}`);
  }

  return (data as ProjectProfile | null) ?? null;
}
