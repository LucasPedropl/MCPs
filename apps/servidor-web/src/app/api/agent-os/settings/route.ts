import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getAgentOsDb } from "@/lib/agent-os-db";

import type { SettingFlag } from "@/features/agent-os/types/settings";

const FLAGS_KEY = "system_flags";

const DEFAULT_FLAGS: SettingFlag[] = [
  {
    key: "realtimeWorker",
    value: false,
    description: "Habilita worker realtime do Agent OS (AGENT_OS_REALTIME_WORKER=1).",
  },
  {
    key: "readOnlySupabase",
    value: false,
    description: "Modo read-only no supabase-hub (settings.readOnly).",
  },
  {
    key: "autoSyncSkills",
    value: false,
    description: "Sincroniza skills do monorepo ao iniciar (futuro).",
  },
];

function maskKey(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function agentOsDistPath(): string {
  const monorepoRoot = path.resolve(process.cwd(), "..", "..");
  return path.join(monorepoRoot, "packages", "agent-os", "dist", "index.js").replace(/\\/g, "/");
}

function buildMcpSnippet(url: string | undefined, keyPlaceholder: string) {
  return {
    command: "node",
    args: [agentOsDistPath()],
    env: {
      AGENT_OS_SUPABASE_URL: url ?? "<sua_url>",
      AGENT_OS_SUPABASE_KEY: keyPlaceholder,
      AGENT_OS_DEFAULT_CWD: "${workspaceFolder}",
      AGENT_OS_REALTIME_WORKER: "0",
      SUPABASE_HUB_CONFIG_DIR: "C:/Users/Pedro/.supabase-mcp-hub",
    },
  };
}

async function loadFlags(db: NonNullable<ReturnType<typeof getAgentOsDb>>): Promise<SettingFlag[]> {
  const { data } = await db
    .from("agent_preferences")
    .select("value_json")
    .eq("key", FLAGS_KEY)
    .eq("scope", "global")
    .maybeSingle();

  const stored = (data?.value_json ?? {}) as Record<string, boolean>;
  return DEFAULT_FLAGS.map((flag) => ({
    ...flag,
    value: stored[flag.key] ?? flag.value,
  }));
}

async function saveFlags(
  db: NonNullable<ReturnType<typeof getAgentOsDb>>,
  updates: Record<string, boolean>,
): Promise<SettingFlag[]> {
  const current = await loadFlags(db);
  const merged: Record<string, boolean> = {};
  for (const flag of current) {
    merged[flag.key] = updates[flag.key] ?? flag.value;
  }

  await db.from("agent_preferences").upsert(
    {
      key: FLAGS_KEY,
      value_json: merged,
      scope: "global",
      workspace_path: null,
      priority: 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key,scope,workspace_path" },
  );

  return DEFAULT_FLAGS.map((flag) => ({
    ...flag,
    value: merged[flag.key] ?? flag.value,
  }));
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const db = getAgentOsDb();

  let hubCount = 0;
  let flags = DEFAULT_FLAGS;
  if (db) {
    const [{ count }, loadedFlags] = await Promise.all([
      db.from("mcp_hub_connections").select("*", { count: "exact", head: true }),
      loadFlags(db),
    ]);
    hubCount = count ?? 0;
    flags = loadedFlags;
  }

  const mcpSnippet = buildMcpSnippet(url, "<sua_key>");

  return NextResponse.json({
    configured: Boolean(db),
    supabase: {
      url: url ?? null,
      serviceRoleKey: maskKey(serviceKey),
      anonKey: maskKey(anonKey),
    },
    env: {
      AGENT_OS_SUPABASE_URL: Boolean(process.env.AGENT_OS_SUPABASE_URL),
      AGENT_OS_SUPABASE_KEY: Boolean(process.env.AGENT_OS_SUPABASE_KEY),
      AGENT_OS_DEFAULT_CWD: Boolean(process.env.AGENT_OS_DEFAULT_CWD),
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      NEXT_PUBLIC_API_URL: Boolean(process.env.NEXT_PUBLIC_API_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    hubCount,
    flags,
    configPaths: {
      cursor: `${process.env.USERPROFILE ?? "~"}/.cursor/mcp.json`,
      antigravity: `${process.env.USERPROFILE ?? "~"}/.gemini/config/mcp_config.json`,
    },
    mcpSnippet,
    antigravitySnippet: mcpSnippet,
  });
}

export async function PATCH(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const rawFlags = body.flags;

  if (typeof rawFlags !== "object" || rawFlags === null || Array.isArray(rawFlags)) {
    return NextResponse.json({ error: "flags deve ser um objeto" }, { status: 400 });
  }

  const updates: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(rawFlags)) {
    if (typeof value === "boolean") {
      updates[key] = value;
    }
  }

  const flags = await saveFlags(db, updates);
  return NextResponse.json({ ok: true, flags });
}
