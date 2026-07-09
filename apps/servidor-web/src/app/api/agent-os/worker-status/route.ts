import { NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

function isWorkerEnvEnabled(): boolean {
  const value =
    process.env.AGENT_OS_REALTIME_WORKER?.trim() ??
    process.env.BRIDGE_REALTIME_WORKER?.trim();
  return value === "1";
}

export async function GET() {
  const db = getAgentOsDb();
  const envEnabled = isWorkerEnvEnabled();

  let pendingJobsCount = 0;
  let configured = false;

  if (db) {
    configured = true;
    const { count, error } = await db
      .from("delegation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    pendingJobsCount = count ?? 0;
  }

  return NextResponse.json({
    configured,
    envEnabled,
    pendingJobsCount,
    envVars: {
      AGENT_OS_REALTIME_WORKER: Boolean(process.env.AGENT_OS_REALTIME_WORKER),
      BRIDGE_REALTIME_WORKER: Boolean(process.env.BRIDGE_REALTIME_WORKER),
    },
    hint: configured
      ? envEnabled
        ? "Worker habilitado via env — jobs pending serão processados pelo MCP agent-os."
        : "Defina AGENT_OS_REALTIME_WORKER=1 no mcp.json do agent-os para ativar o worker."
      : "Configure Supabase no servidor-web para monitorar jobs pending.",
  });
}
