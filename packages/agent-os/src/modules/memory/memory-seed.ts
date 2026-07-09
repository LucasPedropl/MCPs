import * as fs from "node:fs";
import * as path from "node:path";
import type { MemoryScope } from "@mcps/shared";
import { upsertPreference } from "./memory-store.js";

const DEFAULT_PEDRO_PREFERENCES: Array<{
  key: string;
  value: Record<string, unknown>;
  scope: MemoryScope;
  priority: number;
}> = [
  {
    key: "language",
    value: { rule: "Sempre responder em Português (Brasil)" },
    scope: "global",
    priority: 100,
  },
  {
    key: "stack",
    value: {
      frontend: "Next.js + TypeScript + Tailwind + Shadcn",
      forms: "react-hook-form + zod",
      backend: "Supabase com RLS",
    },
    scope: "global",
    priority: 90,
  },
  {
    key: "architecture",
    value: {
      pattern: "Smart/Dumb components",
      dataLayer: "UI -> Hook -> Service -> Supabase",
      maxLinesPerFile: 200,
    },
    scope: "global",
    priority: 85,
  },
  {
    key: "supabase_mcp",
    value: {
      rule: "Usar data module do agent-os para operações no banco",
      flow: "get_active_project -> switch_project antes de SQL",
    },
    scope: "global",
    priority: 80,
  },
  {
    key: "ui_selects",
    value: { rule: "Todos os selects devem ser pesquisáveis" },
    scope: "global",
    priority: 70,
  },
  {
    key: "no_alerts",
    value: { rule: "Nunca usar alert(); usar toasts/console" },
    scope: "global",
    priority: 95,
  },
  {
    key: "typescript_strict",
    value: { rule: "Proibido any; usar unknown + narrowing" },
    scope: "global",
    priority: 88,
  },
  {
    key: "temp_files",
    value: { rule: "Scripts temporários em trash/ e apagar ao final" },
    scope: "global",
    priority: 50,
  },
];

export async function seedPedroPreferences(): Promise<number> {
  let count = 0;
  for (const pref of DEFAULT_PEDRO_PREFERENCES) {
    await upsertPreference({
      key: pref.key,
      value: pref.value,
      scope: pref.scope,
      priority: pref.priority,
    });
    count += 1;
  }
  return count;
}

export async function importRulesFromWorkspace(workspacePath: string): Promise<{
  imported: number;
  sources: string[];
}> {
  const sources: string[] = [];
  let imported = 0;

  const candidates = [
    path.join(workspacePath, ".cursor", "rules"),
    path.join(workspacePath, ".cursor", "skills"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const entries = fs.readdirSync(candidate, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() && !entry.isDirectory()) {
        continue;
      }

      const fullPath = path.join(candidate, entry.name);
      if (entry.isDirectory()) {
        const skillFile = path.join(fullPath, "SKILL.md");
        if (fs.existsSync(skillFile)) {
          const content = fs.readFileSync(skillFile, "utf8");
          await upsertPreference({
            key: `rule:${entry.name}`,
            value: { source: skillFile, content: content.slice(0, 4000) },
            scope: "project",
            workspacePath,
            priority: 40,
          });
          imported += 1;
          sources.push(skillFile);
        }
        continue;
      }

      if (entry.name.endsWith(".md") || entry.name.endsWith(".mdc")) {
        const content = fs.readFileSync(fullPath, "utf8");
        await upsertPreference({
          key: `rule:${entry.name}`,
          value: { source: fullPath, content: content.slice(0, 4000) },
          scope: "project",
          workspacePath,
          priority: 40,
        });
        imported += 1;
        sources.push(fullPath);
      }
    }
  }

  return { imported, sources };
}
