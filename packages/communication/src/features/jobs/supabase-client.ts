import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://xrjjzyfevbuuxeundgds.supabase.co";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  return process.env["BRIDGE_SUPABASE_URL"]?.trim() || DEFAULT_SUPABASE_URL;
}

export function getSupabaseKey(): string | null {
  const key =
    process.env["BRIDGE_SUPABASE_KEY"]?.trim() ||
    process.env["BRIDGE_SUPABASE_ANON_KEY"]?.trim() ||
    null;
  return key;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseKey() !== null;
}

export function getSupabaseClient(): SupabaseClient {
  const key = getSupabaseKey();
  if (!key) {
    throw new Error(
      "Supabase não configurado. Defina BRIDGE_SUPABASE_KEY no env do ide-bridge (mcp.json global).",
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(getSupabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cachedClient;
}

export function getSupabaseStatus(): {
  configured: boolean;
  url: string;
  reachable: boolean | null;
} {
  return {
    configured: isSupabaseConfigured(),
    url: getSupabaseUrl(),
    reachable: null,
  };
}

/** Verifica conectividade com uma query leve. */
export async function probeSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.from("delegation_jobs").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
