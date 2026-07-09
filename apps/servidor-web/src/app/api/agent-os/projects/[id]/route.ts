import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";
import {
  deleteProject,
  getProjectById,
  upsertProject,
} from "@mcps/agent-os/projects";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ configured: false }, { status: 503 });

  const { id } = await params;

  try {
    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ configured: true, project });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha ao buscar projeto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const project = await upsertProject({
      id,
      slug: body.slug as string | undefined,
      title: body.title as string | undefined,
      title_en: (body.title_en as string | null) ?? undefined,
      description: body.description as string | undefined,
      description_en: (body.description_en as string | null) ?? undefined,
      tags: body.tags as string[] | undefined,
      type: body.type as "frontend" | "backend" | "fullstack" | undefined,
      featured: body.featured as boolean | undefined,
      cover_image_url: (body.cover_image_url as string | null) ?? undefined,
      github_url: (body.github_url as string | null) ?? undefined,
      deploy_url: (body.deploy_url as string | null) ?? undefined,
      workspace_path: (body.workspace_path as string | null) ?? undefined,
      docs_md: body.docs_md as string | undefined,
      github_owner: (body.github_owner as string | null) ?? undefined,
      github_repo: (body.github_repo as string | null) ?? undefined,
      vercel_project_id: (body.vercel_project_id as string | null) ?? undefined,
      status: body.status as "draft" | "published" | "archived" | undefined,
      portfolio_visible: body.portfolio_visible as boolean | undefined,
    });
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha ao atualizar projeto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const { id } = await params;
  const removeCover = _request.nextUrl.searchParams.get("remove_cover") === "true";

  try {
    await deleteProject(id, removeCover);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha ao deletar projeto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
