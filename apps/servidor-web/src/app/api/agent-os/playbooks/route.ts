import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

export async function GET() {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ configured: false, items: [] });

  const { data, error } = await db
    .from("agent_playbooks")
    .select("id, server_id, alias, author, version_tag, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const row = {
    server_id: (body.server_id as string | null) ?? null,
    alias: (body.alias as string | null) ?? null,
    content_md: String(body.content_md ?? ""),
    author: String(body.author ?? "ai"),
    version_tag: String(body.version_tag ?? "1.0.0"),
  };

  if (!row.content_md) {
    return NextResponse.json({ error: "content_md é obrigatório" }, { status: 400 });
  }

  const { data, error } = await db.from("agent_playbooks").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const { error } = await db.from("agent_playbooks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
