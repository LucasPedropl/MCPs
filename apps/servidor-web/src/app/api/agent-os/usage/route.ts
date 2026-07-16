import { NextResponse } from "next/server";
import {
  aggregateToolEvents,
  getToolDocsMap,
  listDocumentedToolNames,
} from "@mcps/agent-os/telemetry";
import { getAgentOsDb } from "@/lib/agent-os-db";

const HOSTS = new Set(["cursor", "antigravity", "claude_code", "unknown"]);

interface ToolEventMeta {
  alias?: string;
  child_tool?: string;
}

interface ToolEventRow {
  tool_name: string;
  host: string;
  ok: boolean;
  duration_ms: number | null;
  module: string | null;
  meta: ToolEventMeta;
  created_at: string;
}

function parseDays(raw: string | null): number {
  const parsed = Number(raw ?? "30");
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.max(1, Math.min(Math.floor(parsed), 365));
}

export async function GET(request: Request) {
  const db = getAgentOsDb();
  if (!db) {
    return NextResponse.json({ configured: false });
  }

  const url = new URL(request.url);
  const days = parseDays(url.searchParams.get("days"));
  const hostParam = url.searchParams.get("host");
  const host =
    hostParam && HOSTS.has(hostParam) ? hostParam : undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(Math.floor(limitRaw), 100))
    : 20;

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();

  let query = db
    .from("agent_tool_events")
    .select("tool_name, host, ok, duration_ms, module, meta, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (host) {
    query = query.eq("host", host);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { configured: true, success: false, message: error.message },
      { status: 500 },
    );
  }

  const events: ToolEventRow[] = (data ?? []).map((row) => ({
    tool_name: String(row.tool_name),
    host: String(row.host),
    ok: Boolean(row.ok),
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : null,
    module: typeof row.module === "string" ? row.module : null,
    meta:
      row.meta && typeof row.meta === "object"
        ? (row.meta as ToolEventMeta)
        : {},
    created_at: String(row.created_at),
  }));

  const report = aggregateToolEvents(events, {
    days,
    sinceIso,
    untilIso,
    registeredTools: listDocumentedToolNames(),
    limit,
  });

  return NextResponse.json({
    configured: true,
    success: true,
    ...report,
    tool_docs: getToolDocsMap(),
  });
}
