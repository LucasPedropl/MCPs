import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";
import {
  buildOpenApiAlias,
  buildOpenApiHubConfig,
  getPresetsPath,
} from "@/lib/agent-os-paths";
import fs from "node:fs";

const HUB_PRESETS = [
  {
    alias: "github",
    transport: "stdio",
    config_json: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
    },
  },
  {
    alias: "vercel",
    transport: "stdio",
    config_json: {
      command: "npx",
      args: ["-y", "@vercel/mcp-server"],
      env: { VERCEL_TOKEN: "${VERCEL_TOKEN}" },
    },
  },
  {
    alias: "supabase-official",
    transport: "stdio",
    config_json: {
      command: "npx",
      args: ["-y", "@supabase/mcp-server"],
      env: { SUPABASE_ACCESS_TOKEN: "${SUPABASE_ACCESS_TOKEN}" },
    },
  },
] as const;

interface McpServerRow {
  id: string;
  name: string;
  swagger_url: string;
  api_base_url: string;
  auth_type: string;
  created_at: string;
}

async function fetchMcpServers(db: NonNullable<ReturnType<typeof getAgentOsDb>>) {
  const { data, error } = await db
    .from("mcp_servers")
    .select("id, name, swagger_url, api_base_url, auth_type, created_at")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as McpServerRow[];
}

export async function GET() {
  const db = getAgentOsDb();
  if (!db) {
    return NextResponse.json({ configured: false, connections: [], mcp_servers: [] });
  }

  const [{ data, error }, mcp_servers] = await Promise.all([
    db.from("mcp_hub_connections").select("*").order("alias"),
    fetchMcpServers(db),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, connections: data ?? [], mcp_servers });
}

export async function POST(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;

  if (body.action === "register_presets") {
    const presetsPath = getPresetsPath();
    const source = fs.existsSync(presetsPath)
      ? ((JSON.parse(fs.readFileSync(presetsPath, "utf8")) as {
          presets?: Array<{ alias: string; transport: string; config: Record<string, unknown> }>;
        }).presets ?? [])
      : HUB_PRESETS.map((p) => ({
          alias: p.alias,
          transport: p.transport,
          config: p.config_json,
        }));

    const registered: string[] = [];
    for (const preset of source) {
      const config_json = "config" in preset ? preset.config : {};
      const { error } = await db.from("mcp_hub_connections").upsert(
        {
          alias: preset.alias,
          transport: preset.transport,
          config_json,
          status: "disconnected",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "alias" },
      );
      if (!error) registered.push(preset.alias);
    }
    return NextResponse.json({ ok: true, registered });
  }

  if (body.action === "connect_openapi") {
    const serverId = String(body.server_id ?? "");
    if (!serverId) {
      return NextResponse.json({ error: "server_id é obrigatório" }, { status: 400 });
    }

    const { data: server, error: fetchErr } = await db
      .from("mcp_servers")
      .select("id, name")
      .eq("id", serverId)
      .single();

    if (fetchErr || !server) {
      return NextResponse.json({ error: "Servidor não encontrado" }, { status: 404 });
    }

    try {
      const alias = buildOpenApiAlias(server as { id: string; name: string });
      const config_json = buildOpenApiHubConfig(serverId);
      const { data, error } = await db
        .from("mcp_hub_connections")
        .upsert(
          {
            alias,
            transport: "openapi",
            config_json,
            status: "disconnected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "alias" },
        )
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, connection: data, alias });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao conectar OpenAPI";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (body.action === "refresh_health") {
    const alias = String(body.alias ?? "");
    if (!alias) {
      return NextResponse.json({ error: "alias é obrigatório" }, { status: 400 });
    }

    const { data: conn, error: fetchErr } = await db
      .from("mcp_hub_connections")
      .select("*")
      .eq("alias", alias)
      .single();

    if (fetchErr || !conn) {
      return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
    }

    const toolCount = Array.isArray(conn.tool_cache_json) ? conn.tool_cache_json.length : 0;
    const { data, error } = await db
      .from("mcp_hub_connections")
      .update({
        last_health_at: new Date().toISOString(),
        status: toolCount > 0 ? "connected" : conn.status,
        updated_at: new Date().toISOString(),
      })
      .eq("alias", alias)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      connection: data,
      note: "Health real via refresh_mcp_health no MCP agent-os (ping listTools).",
    });
  }

  const alias = String(body.alias ?? "");
  const transport = String(body.transport ?? "stdio");
  const config_json = (body.config_json as Record<string, unknown>) ?? {};

  if (!alias) {
    return NextResponse.json({ error: "alias é obrigatório" }, { status: 400 });
  }

  const { data, error } = await db
    .from("mcp_hub_connections")
    .upsert(
      {
        alias,
        transport,
        config_json,
        status: "disconnected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alias" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connection: data });
}

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const alias = request.nextUrl.searchParams.get("alias");
  if (!alias) return NextResponse.json({ error: "alias é obrigatório" }, { status: 400 });

  const { error } = await db.from("mcp_hub_connections").delete().eq("alias", alias);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
