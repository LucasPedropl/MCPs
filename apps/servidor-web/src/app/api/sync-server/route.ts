import { NextResponse } from "next/server";
import { runOpenApiSync } from "@mcps/openapi-engine/sync";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serverId } = body;

    if (!serverId || typeof serverId !== "string") {
      return NextResponse.json({ error: "ID do servidor é obrigatório." }, { status: 400 });
    }

    const summaryText = await runOpenApiSync(serverId);

    return NextResponse.json({
      success: true,
      report: { report_summary: summaryText },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno na sincronização.";
    console.error("Erro na rota de sincronização:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
