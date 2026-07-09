import { NextRequest, NextResponse } from "next/server";
import { getAgentOsDb } from "@/lib/agent-os-db";

export interface PolicyRow {
  id: string;
  intent: string;
  action_pattern: string;
  rule: { effect: "allow" | "deny"; reason?: string };
  enabled: boolean;
  created_at: string;
}

function parseRule(raw: unknown): PolicyRow["rule"] {
  if (typeof raw === "object" && raw !== null && "effect" in raw) {
    const record = raw as { effect?: string; reason?: string };
    return {
      effect: record.effect === "allow" ? "allow" : "deny",
      reason: record.reason,
    };
  }
  return { effect: "deny" };
}

export async function GET() {
  const db = getAgentOsDb();
  if (!db) {
    return NextResponse.json({ configured: false, items: [] });
  }

  const { data, error } = await db
    .from("agent_policies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => ({
    ...(row as Omit<PolicyRow, "rule">),
    rule: parseRule((row as { rule: unknown }).rule),
  }));

  return NextResponse.json({ configured: true, items });
}

export async function POST(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const intent = String(body.intent ?? "");
  const actionPattern = String(body.action_pattern ?? "");
  const rule = parseRule(body.rule);
  const enabled = body.enabled !== false;

  if (!intent || !actionPattern) {
    return NextResponse.json(
      { error: "intent e action_pattern são obrigatórios" },
      { status: 400 },
    );
  }

  const row = {
    intent,
    action_pattern: actionPattern,
    rule,
    enabled,
  };

  if (typeof body.id === "string" && body.id.length > 0) {
    const { data, error } = await db
      .from("agent_policies")
      .update(row)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      item: { ...(data as Omit<PolicyRow, "rule">), rule: parseRule((data as { rule: unknown }).rule) },
    });
  }

  const { data, error } = await db.from("agent_policies").insert(row).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    item: { ...(data as Omit<PolicyRow, "rule">), rule: parseRule((data as { rule: unknown }).rule) },
  });
}

export async function DELETE(request: NextRequest) {
  const db = getAgentOsDb();
  if (!db) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const { error } = await db.from("agent_policies").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
