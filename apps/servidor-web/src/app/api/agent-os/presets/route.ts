import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getPresetsPath } from "@/lib/agent-os-paths";

interface PresetsFile {
  presets: Array<{
    alias: string;
    transport: string;
    config: Record<string, unknown>;
  }>;
}

async function readPresets(): Promise<PresetsFile> {
  const path = getPresetsPath();
  try {
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw) as PresetsFile;
  } catch {
    return { presets: [] };
  }
}

export async function GET() {
  const path = getPresetsPath();
  const data = await readPresets();
  return NextResponse.json({ path, ...data });
}

export async function PATCH(request: NextRequest) {
  const path = getPresetsPath();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("presets" in body)) {
    return NextResponse.json({ error: "Corpo deve conter presets[]" }, { status: 400 });
  }

  const presets = (body as PresetsFile).presets;
  if (!Array.isArray(presets)) {
    return NextResponse.json({ error: "presets deve ser um array" }, { status: 400 });
  }

  const normalized: PresetsFile = { presets: [] };
  for (const item of presets) {
    if (!item.alias || !item.transport || !item.config) {
      return NextResponse.json(
        { error: "Cada preset precisa de alias, transport e config" },
        { status: 400 },
      );
    }
    normalized.presets.push({
      alias: String(item.alias),
      transport: String(item.transport),
      config: item.config as Record<string, unknown>,
    });
  }

  await fs.writeFile(path, JSON.stringify(normalized, null, 2), "utf8");
  return NextResponse.json({ ok: true, path, presets: normalized.presets });
}
