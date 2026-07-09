import { NextResponse } from "next/server";
import { syncSkillsFromRepo } from "@mcps/agent-os/knowledge";

export async function POST() {
  try {
    const result = await syncSkillsFromRepo();
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      names: result.names,
      skillsRoot: result.skillsRoot,
      note:
        result.synced > 0
          ? `${result.synced} skill(s) sincronizada(s): ${result.names.join(", ")}`
          : "Nenhuma skill encontrada em skills/ — verifique o monorepo.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha ao sincronizar skills";
    console.error("sync-skills:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
