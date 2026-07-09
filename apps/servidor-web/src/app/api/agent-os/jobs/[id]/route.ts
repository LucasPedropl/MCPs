import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ configured: false }, { status: 503 });

  const { id } = await params;

  const [jobResult, eventsResult] = await Promise.all([
    db.from("delegation_jobs").select("*").eq("id", id).maybeSingle(),
    db
      .from("job_events")
      .select("id, event_type, payload, created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (jobResult.error) {
    return NextResponse.json({ error: jobResult.error.message }, { status: 500 });
  }
  if (!jobResult.data) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }
  if (eventsResult.error) {
    return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    configured: true,
    job: jobResult.data,
    events: eventsResult.data ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const { id } = await params;
  const body = (await request.json()) as { action?: string };
  const action = body.action;

  if (action === "cancel") {
    const { data, error } = await db
      .from("delegation_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["pending", "running", "awaiting_approval"])
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json(
        { error: "Job não encontrado ou não pode ser cancelado" },
        { status: 400 },
      );
    }
    return NextResponse.json({ job: data });
  }

  if (action === "retry") {
    const { data, error } = await db
      .from("delegation_jobs")
      .update({
        status: "pending",
        error: null,
        response: null,
        started_at: null,
        completed_at: null,
      })
      .eq("id", id)
      .in("status", ["failed", "cancelled"])
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json(
        { error: "Job não encontrado ou não pode ser reexecutado" },
        { status: 400 },
      );
    }
    return NextResponse.json({ job: data });
  }

  return NextResponse.json({ error: "action inválida (cancel ou retry)" }, { status: 400 });
}
