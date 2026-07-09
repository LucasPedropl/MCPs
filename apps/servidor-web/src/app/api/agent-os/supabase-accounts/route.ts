import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getSupabaseHubConfigPath } from "@/lib/agent-os-paths";

interface HubAccount {
  id: string;
  label: string;
  email?: string;
  createdAt: string;
}

interface HubProject {
  id: string;
  accountId: string;
  ref: string;
  name: string;
  url: string;
}

interface HubConfigFile {
  accounts?: HubAccount[];
  projects?: HubProject[];
  activeContext?: { accountId: string; projectRef: string; projectName?: string } | null;
}

export async function GET() {
  const configPath = getSupabaseHubConfigPath();

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as HubConfigFile;

    return NextResponse.json({
      configured: true,
      configPath,
      accounts: (parsed.accounts ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        email: a.email ?? null,
        createdAt: a.createdAt,
      })),
      projects: (parsed.projects ?? []).map((p) => ({
        id: p.id,
        accountId: p.accountId,
        ref: p.ref,
        name: p.name,
        url: p.url,
      })),
      activeContext: parsed.activeContext ?? null,
      note: "PATs não são expostos. Use hub_status ou list_accounts no MCP supabase-hub.",
    });
  } catch {
    return NextResponse.json({
      configured: false,
      configPath,
      accounts: [],
      projects: [],
      activeContext: null,
      note: "Arquivo não encontrado. Use hub_status no MCP supabase-hub para gerenciar contas.",
    });
  }
}
