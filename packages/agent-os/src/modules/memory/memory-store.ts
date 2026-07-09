import type { MemoryScope } from "@mcps/shared";
import { getSupabaseClient, isSupabaseConfigured } from "../../features/supabase-client.js";

export interface PreferenceRecord {
  id: string;
  key: string;
  value_json: Record<string, unknown>;
  scope: MemoryScope;
  workspace_path: string | null;
  priority: number;
}

export interface DecisionRecord {
  id: string;
  project: string | null;
  topic: string;
  problem: string | null;
  chosen_option: string;
  rationale: string | null;
  links: string[];
  workspace_path: string | null;
  created_at: string;
}

export interface PitfallRecord {
  id: string;
  project: string | null;
  symptom: string;
  root_cause: string | null;
  fix: string;
  tags: string[];
  workspace_path: string | null;
  created_at: string;
}

export interface TaskLogRecord {
  id: string;
  task_id: string;
  summary: string;
  host: string | null;
  provider: string | null;
  outcome: string;
  artifacts_json: Record<string, unknown>;
  workspace_path: string | null;
  created_at: string;
}

export async function upsertPreference(input: {
  key: string;
  value: Record<string, unknown>;
  scope: MemoryScope;
  workspacePath?: string;
  priority?: number;
}): Promise<PreferenceRecord> {
  const client = getSupabaseClient();
  const workspacePath = input.workspacePath ?? null;

  let lookup = client
    .from("agent_preferences")
    .select("id")
    .eq("key", input.key)
    .eq("scope", input.scope);

  lookup =
    workspacePath === null
      ? lookup.is("workspace_path", null)
      : lookup.eq("workspace_path", workspacePath);

  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) {
    throw new Error(`Falha ao buscar preferência: ${lookupError.message}`);
  }

  const payload = {
    key: input.key,
    value_json: input.value,
    scope: input.scope,
    workspace_path: workspacePath,
    priority: input.priority ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing?.id
    ? await client
        .from("agent_preferences")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single()
    : await client.from("agent_preferences").insert(payload).select().single();

  if (error) {
    throw new Error(`Falha ao salvar preferência: ${error.message}`);
  }

  return data as PreferenceRecord;
}

export async function listPreferences(
  workspacePath?: string,
): Promise<PreferenceRecord[]> {
  const client = getSupabaseClient();
  let query = client
    .from("agent_preferences")
    .select("*")
    .order("priority", { ascending: false });

  if (workspacePath) {
    query = query.or(`scope.eq.global,and(scope.eq.project,workspace_path.eq.${workspacePath})`);
  } else {
    query = query.eq("scope", "global");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao listar preferências: ${error.message}`);
  }

  return (data ?? []) as PreferenceRecord[];
}

export async function deletePreference(input: {
  id?: string;
  key?: string;
  scope?: MemoryScope;
  workspacePath?: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (input.id) {
    const { error } = await client.from("agent_preferences").delete().eq("id", input.id);
    if (error) throw new Error(`Falha ao deletar preferência: ${error.message}`);
    return;
  }
  if (!input.key) throw new Error("Informe id ou key para deletar preferência.");
  let query = client.from("agent_preferences").delete().eq("key", input.key);
  if (input.scope) query = query.eq("scope", input.scope);
  if (input.workspacePath) query = query.eq("workspace_path", input.workspacePath);
  const { error } = await query;
  if (error) throw new Error(`Falha ao deletar preferência: ${error.message}`);
}

export async function listDecisions(filters?: {
  project?: string;
  workspacePath?: string;
  limit?: number;
}): Promise<DecisionRecord[]> {
  const client = getSupabaseClient();
  let query = client.from("agent_decisions").select("*").order("created_at", { ascending: false });
  if (filters?.project) query = query.eq("project", filters.project);
  if (filters?.workspacePath) query = query.eq("workspace_path", filters.workspacePath);
  if (filters?.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar decisões: ${error.message}`);
  return (data ?? []) as DecisionRecord[];
}

export async function updateDecision(
  id: string,
  updates: { rationale?: string; links?: string[]; chosen_option?: string },
): Promise<DecisionRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_decisions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Falha ao atualizar decisão: ${error.message}`);
  return data as DecisionRecord;
}

export async function deleteDecision(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("agent_decisions").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar decisão: ${error.message}`);
}

export async function listPitfalls(filters?: {
  project?: string;
  workspacePath?: string;
  limit?: number;
}): Promise<PitfallRecord[]> {
  const client = getSupabaseClient();
  let query = client.from("agent_pitfalls").select("*").order("created_at", { ascending: false });
  if (filters?.project) query = query.eq("project", filters.project);
  if (filters?.workspacePath) query = query.eq("workspace_path", filters.workspacePath);
  if (filters?.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar pitfalls: ${error.message}`);
  return (data ?? []) as PitfallRecord[];
}

export async function deletePitfall(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("agent_pitfalls").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar pitfall: ${error.message}`);
}

export async function saveDecision(input: {
  project?: string;
  topic: string;
  problem?: string;
  chosenOption: string;
  rationale?: string;
  links?: string[];
  workspacePath?: string;
}): Promise<DecisionRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_decisions")
    .insert({
      project: input.project ?? null,
      topic: input.topic,
      problem: input.problem ?? null,
      chosen_option: input.chosenOption,
      rationale: input.rationale ?? null,
      links: input.links ?? [],
      workspace_path: input.workspacePath ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao salvar decisão: ${error.message}`);
  }

  return data as DecisionRecord;
}

export async function savePitfall(input: {
  project?: string;
  symptom: string;
  rootCause?: string;
  fix: string;
  tags?: string[];
  workspacePath?: string;
}): Promise<PitfallRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_pitfalls")
    .insert({
      project: input.project ?? null,
      symptom: input.symptom,
      root_cause: input.rootCause ?? null,
      fix: input.fix,
      tags: input.tags ?? [],
      workspace_path: input.workspacePath ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao salvar pitfall: ${error.message}`);
  }

  return data as PitfallRecord;
}

export async function recallMemory(input: {
  intent: string;
  workspacePath?: string;
  limit?: number;
}): Promise<{
  preferences: PreferenceRecord[];
  decisions: DecisionRecord[];
  pitfalls: PitfallRecord[];
}> {
  if (!isSupabaseConfigured()) {
    return { preferences: [], decisions: [], pitfalls: [] };
  }

  const client = getSupabaseClient();
  const limit = input.limit ?? 10;
  const tokens = input.intent
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const preferences = await listPreferences(input.workspacePath);

  let decisionsQuery = client
    .from("agent_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.workspacePath) {
    decisionsQuery = decisionsQuery.eq("workspace_path", input.workspacePath);
  }

  const { data: decisions, error: decisionsError } = await decisionsQuery;
  if (decisionsError) {
    throw new Error(`Falha ao buscar decisões: ${decisionsError.message}`);
  }

  let pitfallsQuery = client
    .from("agent_pitfalls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.workspacePath) {
    pitfallsQuery = pitfallsQuery.eq("workspace_path", input.workspacePath);
  }

  const { data: pitfalls, error: pitfallsError } = await pitfallsQuery;
  if (pitfallsError) {
    throw new Error(`Falha ao buscar pitfalls: ${pitfallsError.message}`);
  }

  const rankByIntent = <T extends { topic?: string; symptom?: string; key?: string }>(
    items: T[],
  ): T[] => {
    if (tokens.length === 0) {
      return items;
    }

    return [...items].sort((left, right) => {
      const leftText = `${left.topic ?? ""} ${left.symptom ?? ""} ${left.key ?? ""}`.toLowerCase();
      const rightText = `${right.topic ?? ""} ${right.symptom ?? ""} ${right.key ?? ""}`.toLowerCase();
      const leftScore = tokens.filter((token) => leftText.includes(token)).length;
      const rightScore = tokens.filter((token) => rightText.includes(token)).length;
      return rightScore - leftScore;
    });
  };

  return {
    preferences: preferences.slice(0, limit),
    decisions: rankByIntent((decisions ?? []) as DecisionRecord[]).slice(0, limit),
    pitfalls: rankByIntent((pitfalls ?? []) as PitfallRecord[]).slice(0, limit),
  };
}

export async function logTask(input: {
  taskId: string;
  summary: string;
  host?: string;
  provider?: string;
  outcome: string;
  artifacts?: Record<string, unknown>;
  workspacePath?: string;
}): Promise<TaskLogRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_task_log")
    .insert({
      task_id: input.taskId,
      summary: input.summary,
      host: input.host ?? null,
      provider: input.provider ?? null,
      outcome: input.outcome,
      artifacts_json: input.artifacts ?? {},
      workspace_path: input.workspacePath ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao registrar task log: ${error.message}`);
  }

  return data as TaskLogRecord;
}

export async function getChangesSince(input: {
  since?: string;
  taskId?: string;
  workspacePath?: string;
}): Promise<{
  decisions: DecisionRecord[];
  tasks: TaskLogRecord[];
}> {
  const client = getSupabaseClient();

  let decisionsQuery = client
    .from("agent_decisions")
    .select("*")
    .order("created_at", { ascending: false });

  let tasksQuery = client
    .from("agent_task_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (input.since) {
    decisionsQuery = decisionsQuery.gte("created_at", input.since);
    tasksQuery = tasksQuery.gte("created_at", input.since);
  }

  if (input.taskId) {
    tasksQuery = tasksQuery.eq("task_id", input.taskId);
  }

  if (input.workspacePath) {
    decisionsQuery = decisionsQuery.eq("workspace_path", input.workspacePath);
    tasksQuery = tasksQuery.eq("workspace_path", input.workspacePath);
  }

  const [{ data: decisions, error: dErr }, { data: tasks, error: tErr }] =
    await Promise.all([decisionsQuery, tasksQuery]);

  if (dErr) {
    throw new Error(`Falha ao buscar decisões: ${dErr.message}`);
  }
  if (tErr) {
    throw new Error(`Falha ao buscar tasks: ${tErr.message}`);
  }

  return {
    decisions: (decisions ?? []) as DecisionRecord[],
    tasks: (tasks ?? []) as TaskLogRecord[],
  };
}
