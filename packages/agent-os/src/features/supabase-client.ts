import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getAgentOsSupabaseKey,
  getAgentOsSupabaseUrl,
} from "../config/env.js";

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return getAgentOsSupabaseKey() !== null && getAgentOsSupabaseUrl() !== null;
}

export function getSupabaseClient(): SupabaseClient {
  const key = getAgentOsSupabaseKey();
  const url = getAgentOsSupabaseUrl();
  if (!key || !url) {
    throw new Error(
      "Supabase não configurado. Defina AGENT_OS_SUPABASE_URL e AGENT_OS_SUPABASE_KEY no mcp.json.",
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cachedClient;
}

/**
 * Quota um valor para uso dentro de filtros PostgREST `.or(...)`.
 * Sem isso, vírgulas/parênteses no valor (ex.: paths) quebram ou alteram o filtro.
 */
export function pgrestQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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
