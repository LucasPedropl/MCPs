import { getSupabaseClient, isSupabaseConfigured } from "../jobs/supabase-client.js";
import type { AcquireLockInput, AcquireLockResult, WorkspaceLockRow } from "./types.js";

const DEFAULT_TTL_MS = 300_000;
const POLL_MS = 500;

function mapRow(row: Record<string, unknown>): WorkspaceLockRow {
  return {
    id: String(row["id"]),
    workspace: String(row["workspace"]),
    holder_id: String(row["holder_id"]),
    lock_type: row["lock_type"] === "read" ? "read" : "exclusive",
    acquired_at: String(row["acquired_at"]),
    expires_at: String(row["expires_at"]),
    metadata: (row["metadata"] as Record<string, unknown>) ?? {},
  };
}

function normalizeWorkspace(workspace: string): string {
  return workspace.replace(/\\/g, "/").toLowerCase();
}

/** Remove locks expirados do workspace. */
export async function purgeExpiredLocks(workspace: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }
  const client = getSupabaseClient();
  const now = new Date().toISOString();
  await client
    .from("workspace_locks")
    .delete()
    .eq("workspace", normalizeWorkspace(workspace))
    .lt("expires_at", now);
}

/** Tenta adquirir lock exclusivo no workspace. */
export async function acquireWorkspaceLock(
  input: AcquireLockInput,
): Promise<AcquireLockResult> {
  if (!isSupabaseConfigured()) {
    return { acquired: true, reason: "supabase_offline_noop" };
  }

  const workspace = normalizeWorkspace(input.workspace);
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const lockType = input.lockType ?? "exclusive";

  await purgeExpiredLocks(workspace);

  const client = getSupabaseClient();
  const { data: existing } = await client
    .from("workspace_locks")
    .select("*")
    .eq("workspace", workspace)
    .eq("lock_type", "exclusive")
    .maybeSingle();

  if (existing) {
    const row = mapRow(existing as Record<string, unknown>);
    if (row.holder_id === input.holderId) {
      return { acquired: true, lockId: row.id, expiresAt: row.expires_at };
    }
    return {
      acquired: false,
      reason: `Workspace bloqueado por ${row.holder_id} até ${row.expires_at}`,
    };
  }

  const { data, error } = await client
    .from("workspace_locks")
    .insert({
      workspace,
      holder_id: input.holderId,
      lock_type: lockType,
      expires_at: expiresAt,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    return { acquired: false, reason: error.message };
  }

  const row = mapRow(data as Record<string, unknown>);
  return { acquired: true, lockId: row.id, expiresAt: row.expires_at };
}

/** Aguarda lock com polling (para jobs paralelos sequenciais). */
export async function waitForWorkspaceLock(
  input: AcquireLockInput,
  maxWaitMs = 120_000,
): Promise<AcquireLockResult> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const result = await acquireWorkspaceLock(input);
    if (result.acquired) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return { acquired: false, reason: `Timeout aguardando lock (${maxWaitMs}ms)` };
}

/** Libera lock do holder. */
export async function releaseWorkspaceLock(
  workspace: string,
  holderId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return true;
  }
  const client = getSupabaseClient();
  const { error } = await client
    .from("workspace_locks")
    .delete()
    .eq("workspace", normalizeWorkspace(workspace))
    .eq("holder_id", holderId);

  return !error;
}

/** Executa fn com lock exclusivo (auto-release). */
export async function withWorkspaceLock<T>(
  input: AcquireLockInput,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = await waitForWorkspaceLock(input);
  if (!lock.acquired) {
    throw new Error(lock.reason ?? "Falha ao adquirir workspace lock");
  }
  try {
    return await fn();
  } finally {
    await releaseWorkspaceLock(input.workspace, input.holderId);
  }
}
