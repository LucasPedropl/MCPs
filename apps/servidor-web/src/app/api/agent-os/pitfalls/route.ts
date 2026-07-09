import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

export async function GET() {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ configured: false, items: [] });

  const { data, error } = await db
    .from("agent_pitfalls")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const row = {
    project: (body.project as string | null) ?? null,
    symptom: String(body.symptom ?? ""),
    root_cause: (body.root_cause as string | null) ?? null,
    fix: String(body.fix ?? ""),
    tags: Array.isArray(body.tags) ? body.tags : [],
    workspace_path: (body.workspace_path as string | null) ?? null,
  };

  if (!row.symptom || !row.fix) {
    return NextResponse.json({ error: "symptom e fix são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await db.from("agent_pitfalls").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const { error } = await db.from("agent_pitfalls").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
