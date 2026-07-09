import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

async function countTable(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  return error ? 0 : (count ?? 0);
}

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ configured: false });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [
    preferences,
    skills,
    hubConnections,
    jobs,
    mcpServers,
    decisions,
    pitfalls,
    pendingJobs,
    runningJobs,
  ] = await Promise.all([
    countTable(client, "agent_preferences"),
    countTable(client, "agent_skills"),
    countTable(client, "mcp_hub_connections"),
    countTable(client, "delegation_jobs"),
    countTable(client, "mcp_servers"),
    countTable(client, "agent_decisions"),
    countTable(client, "agent_pitfalls"),
    client
      .from("delegation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .then((r) => r.count ?? 0),
    client
      .from("delegation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "running")
      .then((r) => r.count ?? 0),
  ]);

  const { data: recentJobs } = await client
    .from("delegation_jobs")
    .select("id, status, provider, workspace, created_at, prompt")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: hubRows } = await client
    .from("mcp_hub_connections")
    .select("alias, transport, status, last_health_at, tool_cache_json")
    .order("alias");

  return NextResponse.json({
    configured: true,
    preferences,
    skills,
    hubConnections,
    jobs,
    mcpServers,
    decisions,
    pitfalls,
    pendingJobs,
    runningJobs,
    recentJobs: recentJobs ?? [],
    hub: hubRows ?? [],
  });
}
