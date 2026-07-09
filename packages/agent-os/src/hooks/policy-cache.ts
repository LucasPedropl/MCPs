import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentOsConfigDir } from "../config/env.js";
import { listPolicies, type PolicyRecord } from "../modules/policy/policy-store.js";
import { isSupabaseConfigured } from "../features/supabase-client.js";

const CACHE_TTL_MS = 60_000;

interface PolicyCacheFile {
  fetchedAt: number;
  policies: PolicyRecord[];
}

function cachePath(): string {
  return path.join(getAgentOsConfigDir(), "cache", "policies.json");
}

function readCache(): PolicyCacheFile | null {
  try {
    const filePath = cachePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as PolicyCacheFile;
  } catch {
    return null;
  }
}

function writeCache(policies: PolicyRecord[]): void {
  try {
    const filePath = cachePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({ fetchedAt: Date.now(), policies } satisfies PolicyCacheFile),
      "utf8",
    );
  } catch {
    // cache é otimização — falha silenciosa
  }
}

/**
 * Policies com cache local (TTL 60s) para hooks não baterem no Supabase a
 * cada edição/comando. Em falha de rede, usa cache expirado se existir.
 */
export async function getCachedPolicies(): Promise<PolicyRecord[]> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.policies;
  }

  if (!isSupabaseConfigured()) {
    return cached?.policies ?? [];
  }

  try {
    const policies = await listPolicies();
    writeCache(policies);
    return policies;
  } catch {
    return cached?.policies ?? [];
  }
}
