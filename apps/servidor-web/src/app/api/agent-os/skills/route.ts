import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

function normalizeFilesJson(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export async function GET() {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ configured: false, items: [] });

  const { data, error } = await db
    .from("agent_skills")
    .select(
      "id, name, description, version, scope, content_md, files_json, workspace_path, created_at, updated_at",
    )
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const row = {
    name: String(body.name ?? ""),
    description: String(body.description ?? ""),
    version: String(body.version ?? "1.0.0"),
    scope: String(body.scope ?? "global"),
    content_md: String(body.content_md ?? ""),
    files_json: normalizeFilesJson(body.files_json),
    workspace_path: (body.workspace_path as string | null) ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!row.name) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  const { data, error } = await db
    .from("agent_skills")
    .upsert(row, { onConflict: "name,version" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const name = request.nextUrl.searchParams.get("name");
  const version = request.nextUrl.searchParams.get("version") ?? "1.0.0";
  if (!name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  const { error } = await db
    .from("agent_skills")
    .delete()
    .eq("name", name)
    .eq("version", version);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
