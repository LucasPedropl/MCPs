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

function sortByAcquisition(a: WorkspaceLockRow, b: WorkspaceLockRow): number {
  return a.acquired_at.localeCompare(b.acquired_at) || a.id.localeCompare(b.id);
}

/**
 * Tenta adquirir lock exclusivo no workspace.
 * Sem constraint única no banco, check-then-insert tinha corrida TOCTOU: dois
 * processos "adquiriam" ao mesmo tempo. Agora é insert-then-verify — todos
 * inserem, o lock mais antigo (tiebreak por id) vence e os perdedores removem
 * a própria linha.
 */
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
  const { data: existingRows } = await client
    .from("workspace_locks")
    .select("*")
    .eq("workspace", workspace)
    .eq("lock_type", "exclusive");

  const existing = (existingRows ?? []).map((row) => mapRow(row as Record<string, unknown>));
  const own = existing.find((row) => row.holder_id === input.holderId);
  if (own) {
    return { acquired: true, lockId: own.id, expiresAt: own.expires_at };
  }
  if (existing.length > 0) {
    const holder = existing.sort(sortByAcquisition)[0];
    return {
      acquired: false,
      reason: `Workspace bloqueado por ${holder?.holder_id} até ${holder?.expires_at}`,
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

  const mine = mapRow(data as Record<string, unknown>);

  const { data: verifyRows, error: verifyError } = await client
    .from("workspace_locks")
    .select("*")
    .eq("workspace", workspace)
    .eq("lock_type", "exclusive")
    .gt("expires_at", new Date().toISOString());

  if (!verifyError) {
    const winner = (verifyRows ?? [])
      .map((row) => mapRow(row as Record<string, unknown>))
      .sort(sortByAcquisition)[0];

    if (winner && winner.id !== mine.id) {
      await client.from("workspace_locks").delete().eq("id", mine.id);
      return {
        acquired: false,
        reason: `Workspace bloqueado por ${winner.holder_id} até ${winner.expires_at}`,
      };
    }
  }

  return { acquired: true, lockId: mine.id, expiresAt: mine.expires_at };
}

/** Aguarda lock com polling + backoff (para jobs paralelos sequenciais). */
export async function waitForWorkspaceLock(
  input: AcquireLockInput,
  maxWaitMs = 120_000,
): Promise<AcquireLockResult> {
  const started = Date.now();
  let pollMs = POLL_MS;
  while (Date.now() - started < maxWaitMs) {
    const result = await acquireWorkspaceLock(input);
    if (result.acquired) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    pollMs = Math.min(pollMs * 1.5, 5_000);
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
