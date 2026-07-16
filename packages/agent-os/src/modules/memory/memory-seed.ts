import * as fs from "node:fs";
import * as path from "node:path";
import { upsertPreference } from "./memory-store.js";

const IMPORTED_RULE_MAX_CHARS = 4000;

export interface ImportedRuleSource {
  source: string;
  truncated: boolean;
  originalChars: number;
  importedChars: number;
}

async function importRuleFile(
  filePath: string,
  key: string,
  workspacePath: string,
): Promise<ImportedRuleSource> {
  const content = fs.readFileSync(filePath, "utf8");
  const imported = content.slice(0, IMPORTED_RULE_MAX_CHARS);
  const truncated = content.length > IMPORTED_RULE_MAX_CHARS;

  await upsertPreference({
    key,
    value: {
      source: filePath,
      content: imported,
      ...(truncated ? { truncated: true, original_chars: content.length } : {}),
    },
    scope: "project",
    workspacePath,
    priority: 40,
  });

  return {
    source: filePath,
    truncated,
    originalChars: content.length,
    importedChars: imported.length,
  };
}

export async function importRulesFromWorkspace(workspacePath: string): Promise<{
  imported: number;
  sources: ImportedRuleSource[];
}> {
  const sources: ImportedRuleSource[] = [];

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
          sources.push(await importRuleFile(skillFile, `rule:${entry.name}`, workspacePath));
        }
        continue;
      }

      if (entry.name.endsWith(".md") || entry.name.endsWith(".mdc")) {
        sources.push(await importRuleFile(fullPath, `rule:${entry.name}`, workspacePath));
      }
    }
  }

  return { imported: sources.length, sources };
}
