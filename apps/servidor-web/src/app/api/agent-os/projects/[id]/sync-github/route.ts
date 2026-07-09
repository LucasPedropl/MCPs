import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";
import { syncProjectFromGithub } from "@mcps/agent-os/projects";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const { id } = await params;

  try {
    const result = await syncProjectFromGithub({ id });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha no sync GitHub";
    return NextResponse.json({ ok: false, hint: message }, { status: 500 });
  }
}
