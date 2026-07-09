import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";
import { uploadProjectCover } from "@mcps/agent-os/projects";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const { id } = await params;

  try {
    const body = (await request.json()) as { base64?: string; mime_type?: string };
    if (!body.base64) {
      return NextResponse.json({ error: "base64 é obrigatório" }, { status: 400 });
    }

    const result = await uploadProjectCover({
      projectId: id,
      base64: body.base64,
      mimeType: body.mime_type,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha no upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
