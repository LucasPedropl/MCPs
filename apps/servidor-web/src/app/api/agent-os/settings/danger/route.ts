import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const resetPreferences = request.nextUrl.searchParams.get("resetPreferences") === "true";

  const { error: cacheError } = await db
    .from("mcp_hub_connections")
    .update({
      tool_cache_json: [],
      status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .neq("alias", "__never__");

  if (cacheError) {
    return NextResponse.json({ error: cacheError.message }, { status: 500 });
  }

  let preferencesDeleted = 0;
  if (resetPreferences) {
    const { count, error: prefError } = await db
      .from("agent_preferences")
      .delete({ count: "exact" })
      .neq("key", "__never__");

    if (prefError) {
      return NextResponse.json({ error: prefError.message }, { status: 500 });
    }
    preferencesDeleted = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    toolCacheCleared: true,
    preferencesReset: resetPreferences,
    preferencesDeleted,
    note: resetPreferences
      ? "Tool cache e preferências foram limpos."
      : "Tool cache limpo em todas as conexões do hub.",
  });
}
