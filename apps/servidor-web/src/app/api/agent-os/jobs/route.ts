import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ configured: false, jobs: [] });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const status = request.nextUrl.searchParams.get("status");
  let query = client
    .from("delegation_jobs")
    .select("id, status, provider, workspace, prompt, created_at, updated_at, error")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ configured: true, jobs: data ?? [] });
}
