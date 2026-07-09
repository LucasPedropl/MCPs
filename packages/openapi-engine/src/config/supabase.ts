import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

let cachedClient: SupabaseClient | null = null;

function loadEnvFile(): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../../.env"),
    path.resolve(moduleDir, "../../../../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "apps/servidor-web/.env.local"),
    path.resolve(process.cwd(), "apps/servidor-web/.env"),
    path.resolve(process.cwd(), "apps/servidor-web/.env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const [key, value] of Object.entries(envConfig)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    break;
  }
}

function resolveSupabaseUrl(): string | undefined {
  return (
    process.env["OPENAPI_ENGINE_SUPABASE_URL"] ??
    process.env["SUPABASE_URL"] ??
    process.env["AGENT_OS_SUPABASE_URL"] ??
    process.env["NEXT_PUBLIC_SUPABASE_URL"]
  );
}

function resolveSupabaseKey(): string | undefined {
  return (
    process.env["OPENAPI_ENGINE_SUPABASE_KEY"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["AGENT_OS_SUPABASE_KEY"] ??
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  );
}

/** Returns a singleton Supabase admin client (lazy init). */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  loadEnvFile();

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "OPENAPI_ENGINE_SUPABASE_URL/KEY ou SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não definidos.",
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

/** @deprecated use getSupabaseAdmin */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = client[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
