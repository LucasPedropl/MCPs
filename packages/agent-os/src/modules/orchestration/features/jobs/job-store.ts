import type { BridgeProvider } from "../../client/types.js";
import { getSupabaseClient } from "./supabase-client.js";
import type {
  CreateJobInput,
  DelegationJobRow,
  JobEventRow,
  JobListFilters,
  JobStatus,
  JobStatusSnapshot,
} from "./types.js";

export function mapJobRow(row: Record<string, unknown>): DelegationJobRow {
  return {
    id: String(row["id"]),
    workspace: String(row["workspace"]),
    provider: row["provider"] as BridgeProvider,
    model: row["model"] ? String(row["model"]) : null,
    prompt: String(row["prompt"]),
    status: row["status"] as JobStatus,
    mode: String(row["mode"]),
    agentic_mode: Boolean(row["agentic_mode"]),
    timeout_ms: Number(row["timeout_ms"]),
    response: row["response"] ? String(row["response"]) : null,
    error: row["error"] ? String(row["error"]) : null,
    session_id: row["session_id"] ? String(row["session_id"]) : null,
    cascade_id: row["cascade_id"] ? String(row["cascade_id"]) : null,
    exit_code: row["exit_code"] != null ? Number(row["exit_code"]) : null,
    metadata: (row["metadata"] as Record<string, unknown>) ?? {},
    parent_job_id: row["parent_job_id"] ? String(row["parent_job_id"]) : null,
    created_at: String(row["created_at"]),
    started_at: row["started_at"] ? String(row["started_at"]) : null,
    completed_at: row["completed_at"] ? String(row["completed_at"]) : null,
  };
}

function mapEventRow(row: Record<string, unknown>): JobEventRow {
  return {
    id: String(row["id"]),
    job_id: String(row["job_id"]),
    event_type: String(row["event_type"]),
    payload: (row["payload"] as Record<string, unknown>) ?? {},
    created_at: String(row["created_at"]),
  };
}

export async function createJob(input: CreateJobInput): Promise<DelegationJobRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_jobs")
    .insert({
      workspace: input.workspace,
      provider: input.provider,
      model: input.model ?? null,
      prompt: input.prompt,
      mode: input.mode ?? "subagent",
      agentic_mode: input.agenticMode ?? false,
      timeout_ms: input.timeoutMs ?? 120_000,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
      },
      parent_job_id: input.parentJobId ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao criar job no Supabase");
  }

  return mapJobRow(data as Record<string, unknown>);
}

export async function appendJobEvent(
  jobId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("job_events").insert({
    job_id: jobId,
    event_type: eventType,
    payload,
  });

  if (error) {
    console.error(`[job-store] evento ${eventType} falhou:`, error.message);
  }
}

export async function updateJob(
  jobId: string,
  patch: Partial<{
    status: JobStatus;
    response: string;
    error: string | null;
    session_id: string;
    cascade_id: string;
    exit_code: number;
    model: string;
    started_at: string | null;
    completed_at: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<DelegationJobRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_jobs")
    .update(patch)
    .eq("id", jobId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Falha ao atualizar job ${jobId}`);
  }

  return mapJobRow(data as Record<string, unknown>);
}

export async function getJob(jobId: string): Promise<DelegationJobRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_jobs")
    .select()
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapJobRow(data as Record<string, unknown>) : null;
}

export async function getJobWithEvents(jobId: string): Promise<JobStatusSnapshot | null> {
  const job = await getJob(jobId);
  if (!job) {
    return null;
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("job_events")
    .select()
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const events = (data ?? []).map((row) => mapEventRow(row as Record<string, unknown>));
  return { job, events };
}

export async function listJobs(filters: JobListFilters = {}): Promise<DelegationJobRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("delegation_jobs")
    .select()
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 20);

  if (filters.workspace) {
    query = query.eq("workspace", filters.workspace);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.provider) {
    query = query.eq("provider", filters.provider);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>));
}

export async function listChildJobs(parentJobId: string): Promise<DelegationJobRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("delegation_jobs")
    .select()
    .eq("parent_job_id", parentJobId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>));
}

export async function getJobChunks(
  jobId: string,
  sinceSeq = 0,
  limit = 100,
): Promise<Array<{ seq: number; text: string; created_at: string }>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("job_events")
    .select("payload, created_at")
    .eq("job_id", jobId)
    .eq("event_type", "chunk")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => {
      const payload = (row.payload as Record<string, unknown>) ?? {};
      return {
        seq: Number(payload["seq"] ?? 0),
        text: String(payload["text"] ?? ""),
        created_at: String(row.created_at),
      };
    })
    .filter((chunk) => chunk.seq > sinceSeq);
}
