import * as crypto from "node:crypto";
import * as path from "node:path";
import type { AssembledContext } from "@mcps/shared";
import { getSupabaseClient, isSupabaseConfigured } from "../../features/supabase-client.js";

export interface ContextSnapshotRecord {
  id: string;
  workspace_path: string;
  snapshot_hash: string;
  bundle_json: Record<string, unknown>;
  created_at: string;
}

export interface ContextDiffResult {
  workspace_path: string;
  previous_hash: string | null;
  current_hash: string;
  unchanged: boolean;
  added_keys: string[];
  removed_keys: string[];
  changed_keys: string[];
}

function hashBundle(bundle: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
}

function contextToBundle(context: AssembledContext): Record<string, unknown> {
  return {
    preferences: context.preferences,
    decisions: context.decisions,
    pitfalls: context.pitfalls,
    skills: context.skills.map((skill) => skill.name),
    playbooks: context.playbooks.map((playbook) => playbook.server),
    schema_hints: context.schema_hints ?? [],
    suggested_tools: context.suggested_tools,
    suggested_provider: context.suggested_provider ?? null,
    token_estimate: context.token_estimate,
  };
}

function diffBundles(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): Pick<ContextDiffResult, "added_keys" | "removed_keys" | "changed_keys" | "unchanged"> {
  if (!previous) {
    return {
      unchanged: false,
      added_keys: Object.keys(current),
      removed_keys: [],
      changed_keys: [],
    };
  }

  const prevKeys = new Set(Object.keys(previous));
  const currKeys = new Set(Object.keys(current));
  const added_keys = [...currKeys].filter((key) => !prevKeys.has(key));
  const removed_keys = [...prevKeys].filter((key) => !currKeys.has(key));
  const changed_keys = [...currKeys].filter(
    (key) => prevKeys.has(key) && JSON.stringify(previous[key]) !== JSON.stringify(current[key]),
  );

  return {
    unchanged: added_keys.length === 0 && removed_keys.length === 0 && changed_keys.length === 0,
    added_keys,
    removed_keys,
    changed_keys,
  };
}

export async function getLatestSnapshot(
  workspacePath: string,
): Promise<ContextSnapshotRecord | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const workspace = path.resolve(workspacePath);
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_context_snapshots")
    .select("*")
    .eq("workspace_path", workspace)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar snapshot: ${error.message}`);
  }

  return (data as ContextSnapshotRecord | null) ?? null;
}

export async function saveSnapshot(
  workspacePath: string,
  context: AssembledContext,
): Promise<ContextSnapshotRecord | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const workspace = path.resolve(workspacePath);
  const bundle = contextToBundle(context);
  const snapshotHash = hashBundle(bundle);
  const latest = await getLatestSnapshot(workspace);

  if (latest?.snapshot_hash === snapshotHash) {
    return latest;
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_context_snapshots")
    .insert({
      workspace_path: workspace,
      snapshot_hash: snapshotHash,
      bundle_json: bundle,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao salvar snapshot: ${error.message}`);
  }

  return data as ContextSnapshotRecord;
}

export async function computeContextDiff(
  workspacePath: string,
  context: AssembledContext,
): Promise<ContextDiffResult> {
  const workspace = path.resolve(workspacePath);
  const bundle = contextToBundle(context);
  const currentHash = hashBundle(bundle);
  const latest = await getLatestSnapshot(workspace);
  const diff = diffBundles(latest?.bundle_json ?? null, bundle);

  return {
    workspace_path: workspace,
    previous_hash: latest?.snapshot_hash ?? null,
    current_hash: currentHash,
    ...diff,
  };
}

export async function getContextDiff(workspacePath: string): Promise<ContextDiffResult | null> {
  const latest = await getLatestSnapshot(workspacePath);
  if (!latest) {
    return null;
  }

  const previous = await getPreviousSnapshot(workspacePath, latest.id);
  const diff = diffBundles(previous?.bundle_json ?? null, latest.bundle_json);

  return {
    workspace_path: path.resolve(workspacePath),
    previous_hash: previous?.snapshot_hash ?? null,
    current_hash: latest.snapshot_hash,
    ...diff,
  };
}

async function getPreviousSnapshot(
  workspacePath: string,
  excludeId: string,
): Promise<ContextSnapshotRecord | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const workspace = path.resolve(workspacePath);
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agent_context_snapshots")
    .select("*")
    .eq("workspace_path", workspace)
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar snapshot anterior: ${error.message}`);
  }

  return (data as ContextSnapshotRecord | null) ?? null;
}
