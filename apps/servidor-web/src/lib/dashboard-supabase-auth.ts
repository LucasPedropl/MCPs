import { createClient } from "@supabase/supabase-js";
import { getAgentOsDb } from "@/lib/agent-os-db";

function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
}

/** Anon client for password grant (signInWithPassword). */
export function getSupabaseAuthClient() {
  const url = getSupabaseUrl();
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifyDashboardCredentials(
  email: string,
  password: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const client = getSupabaseAuthClient();
  if (!client) {
    return {
      ok: false,
      error:
        "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    };
  }

  const normalized = email.trim().toLowerCase();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalized,
    password,
  });

  if (error || !data.user) {
    return { ok: false, error: "Credenciais inválidas" };
  }

  return {
    ok: true,
    email: (data.user.email ?? normalized).toLowerCase(),
  };
}

/**
 * Ensures a dashboard user exists in Supabase Auth (idempotent).
 * Uses service_role — password is never stored in app tables/plaintext.
 */
export async function ensureDashboardAuthUser(params: {
  email: string;
  password: string;
}): Promise<{ created: boolean; updated: boolean; email: string; error?: string }> {
  const admin = getAgentOsDb();
  if (!admin) {
    return {
      created: false,
      updated: false,
      email: params.email,
      error: "Service role / Supabase não configurado",
    };
  }

  const email = params.email.trim().toLowerCase();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    return { created: false, updated: false, email, error: listError.message };
  }

  const existing = listed.users.find(
    (user) => (user.email ?? "").toLowerCase() === email,
  );

  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(
      existing.id,
      { password: params.password, email_confirm: true },
    );
    if (updateError) {
      return { created: false, updated: false, email, error: updateError.message };
    }
    return { created: false, updated: true, email };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
  });

  if (createError) {
    return { created: false, updated: false, email, error: createError.message };
  }

  return { created: true, updated: false, email };
}
