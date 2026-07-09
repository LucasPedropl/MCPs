import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

export async function GET() {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ configured: false, items: [] });

  const { data, error } = await db
    .from("agent_preferences")
    .select("*")
    .order("priority", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const row = {
    key: String(body.key ?? ""),
    value_json: body.value_json ?? {},
    scope: String(body.scope ?? "global"),
    workspace_path: (body.workspace_path as string | null) ?? null,
    priority: Number(body.priority ?? 0),
    updated_at: new Date().toISOString(),
  };

  if (!row.key) {
    return NextResponse.json({ error: "key é obrigatório" }, { status: 400 });
  }

  const { data, error } = await db
    .from("agent_preferences")
    .upsert(row, { onConflict: "key,scope,workspace_path" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.key !== undefined) updates.key = String(body.key);
  if (body.value_json !== undefined) updates.value_json = body.value_json;
  if (body.scope !== undefined) updates.scope = String(body.scope);
  if (body.workspace_path !== undefined) updates.workspace_path = (body.workspace_path as string | null) ?? null;
  if (body.priority !== undefined) updates.priority = Number(body.priority);

  const { data, error } = await db
    .from("agent_preferences")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const { error } = await db.from("agent_preferences").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
