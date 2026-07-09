import { getSupabaseClient } from "../jobs/supabase-client.js";
import type {
  AddContextInput,
  CreateSessionInput,
  DelegationSessionRow,
  SessionListFilters,
  SharedContextRow,
} from "./types.js";

function mapSessionRow(row: Record<string, unknown>): DelegationSessionRow {
  return {
    id: String(row["id"]),
    workspace: String(row["workspace"]),
    title: row["title"] ? String(row["title"]) : null,
    provider: row["provider"] as DelegationSessionRow["provider"],
    external_session_id: row["external_session_id"]
      ? String(row["external_session_id"])
      : null,
    model: row["model"] ? String(row["model"]) : null,
    last_prompt: row["last_prompt"] ? String(row["last_prompt"]) : null,
    last_response: row["last_response"] ? String(row["last_response"]) : null,
    metadata: (row["metadata"] as Record<string, unknown>) ?? {},
    created_at: String(row["created_at"]),
    updated_at: String(row["updated_at"]),
  };
}

function mapContextRow(row: Record<string, unknown>): SharedContextRow {
  return {
    id: String(row["id"]),
    session_id: row["session_id"] ? String(row["session_id"]) : null,
    workspace: String(row["workspace"]),
    label: row["label"] ? String(row["label"]) : null,
    content: String(row["content"]),
    content_type: String(row["content_type"] ?? "text"),
    metadata: (row["metadata"] as Record<string, unknown>) ?? {},
    created_at: String(row["created_at"]),
  };
}

export async function createSession(input: CreateSessionInput): Promise<DelegationSessionRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_sessions")
    .insert({
      workspace: input.workspace,
      provider: input.provider,
      title: input.title ?? null,
      external_session_id: input.externalSessionId ?? null,
      model: input.model ?? null,
      last_prompt: input.lastPrompt ?? null,
      last_response: input.lastResponse ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao criar sessão");
  }

  return mapSessionRow(data as Record<string, unknown>);
}

export async function getSession(sessionId: string): Promise<DelegationSessionRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_sessions")
    .select()
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapSessionRow(data as Record<string, unknown>) : null;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<{
    title: string;
    external_session_id: string;
    model: string;
    last_prompt: string;
    last_response: string;
    metadata: Record<string, unknown>;
  }>,
): Promise<DelegationSessionRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Falha ao atualizar sessão ${sessionId}`);
  }

  return mapSessionRow(data as Record<string, unknown>);
}

export async function listSessions(
  filters: SessionListFilters = {},
): Promise<DelegationSessionRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("delegation_sessions")
    .select()
    .order("updated_at", { ascending: false })
    .limit(filters.limit ?? 20);

  if (filters.workspace) {
    query = query.eq("workspace", filters.workspace);
  }
  if (filters.provider) {
    query = query.eq("provider", filters.provider);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapSessionRow(row as Record<string, unknown>));
}

export async function addSharedContext(input: AddContextInput): Promise<SharedContextRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("shared_context")
    .insert({
      workspace: input.workspace,
      session_id: input.sessionId ?? null,
      label: input.label ?? null,
      content: input.content,
      content_type: input.contentType ?? "text",
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao adicionar contexto");
  }

  return mapContextRow(data as Record<string, unknown>);
}

export async function listSharedContext(
  workspace: string,
  sessionId?: string,
  limit = 20,
): Promise<SharedContextRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("shared_context")
    .select()
    .eq("workspace", workspace)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapContextRow(row as Record<string, unknown>));
}
