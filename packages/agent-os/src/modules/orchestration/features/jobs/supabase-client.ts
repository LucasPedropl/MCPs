import {
  getAgentOsSupabaseKey,
  getAgentOsSupabaseUrl,
} from "../../../../config/env.js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  probeSupabaseConnection,
} from "../../../../features/supabase-client.js";

export {
  getSupabaseClient,
  isSupabaseConfigured,
  probeSupabaseConnection,
};

export function getSupabaseUrl(): string | null {
  return getAgentOsSupabaseUrl();
}

export function getSupabaseKey(): string | null {
  return getAgentOsSupabaseKey();
}

export function getSupabaseStatus(): {
  configured: boolean;
  url: string | null;
  reachable: boolean | null;
} {
  return {
    configured: isSupabaseConfigured(),
    url: getAgentOsSupabaseUrl(),
    reachable: null,
  };
}
