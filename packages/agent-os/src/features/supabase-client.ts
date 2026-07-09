import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getAgentOsSupabaseKey,
  getAgentOsSupabaseUrl,
} from "../config/env.js";

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return getAgentOsSupabaseKey() !== null;
}

export function getSupabaseClient(): SupabaseClient {
  const key = getAgentOsSupabaseKey();
  if (!key) {
    throw new Error(
      "Supabase não configurado. Defina AGENT_OS_SUPABASE_KEY no mcp.json.",
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(getAgentOsSupabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cachedClient;
}

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
