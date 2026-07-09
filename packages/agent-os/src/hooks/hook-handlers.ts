import * as path from "node:path";
import {
  listDecisions,
  listPitfalls,
  listPreferences,
} from "../modules/memory/memory-store.js";
import { evaluateDenyPolicies } from "../modules/policy/policy-store.js";
import { isSupabaseConfigured } from "../features/supabase-client.js";
import { getCachedPolicies } from "./policy-cache.js";

export interface HookInput {
  workspace_roots?: string[];
  cwd?: string;
  command?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export function resolveWorkspaceRoot(input: HookInput): string {
  return (
    input.workspace_roots?.[0] ??
    process.env["CURSOR_PROJECT_DIR"] ??
    input.cwd ??
    process.cwd()
  );
}

/** sessionStart: monta resumo de regras/decisões/pitfalls do workspace. */
export async function buildSessionContext(workspace: string): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) {
    return {};
  }

  const [preferences, decisions, pitfalls] = await Promise.all([
    listPreferences(workspace),
    listDecisions({ workspacePath: workspace, limit: 5 }),
    listPitfalls({ workspacePath: workspace, limit: 5 }),
  ]);

  const projectPrefs = preferences
    .filter((pref) => pref.scope === "project")
    .slice(0, 10);

  if (projectPrefs.length === 0 && decisions.length === 0 && pitfalls.length === 0) {
    return {};
  }

  const lines: string[] = [
    "# Agent OS — contexto automático do workspace",
    "",
    `Workspace: ${workspace}`,
    "",
  ];

  if (projectPrefs.length > 0) {
    lines.push("## Regras e preferências do projeto (OBRIGATÓRIAS)", "");
    for (const pref of projectPrefs) {
      lines.push(`- **${pref.key}**: ${JSON.stringify(pref.value_json)}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Decisões arquiteturais", "");
    for (const decision of decisions) {
      lines.push(`- ${decision.topic}: ${decision.chosen_option}`);
    }
    lines.push("");
  }

  if (pitfalls.length > 0) {
    lines.push("## Pitfalls conhecidos", "");
    for (const pitfall of pitfalls) {
      lines.push(`- ${pitfall.symptom} → ${pitfall.fix}`);
    }
    lines.push("");
  }

  lines.push(
    "Use as tools do MCP agent-os (assemble_context, recall_for_task) para detalhes.",
  );

  return { additional_context: lines.join("\n") };
}

function toPosix(text: string): string {
  return text.replace(/\\/g, "/");
}

/** Gera candidatos de action write: para o arquivo (relativo e absoluto). */
function writeActionCandidates(filePath: string, workspace: string): string[] {
  const abs = toPosix(path.resolve(filePath));
  const candidates = [`write:${abs}`];

  const rel = toPosix(path.relative(path.resolve(workspace), path.resolve(filePath)));
  if (rel && !rel.startsWith("..")) {
    candidates.push(`write:${rel}`);
  }
  return candidates;
}

interface Denial {
  reason: string;
  policyId: string;
}

async function findDenial(actions: string[]): Promise<Denial | null> {
  const policies = await getCachedPolicies();
  if (policies.length === 0) {
    return null;
  }

  for (const action of actions) {
    const result = evaluateDenyPolicies(action, policies);
    if (!result.allowed) {
      return {
        reason: result.reason ?? "Bloqueado por policy do Agent OS.",
        policyId: result.matchedPolicy?.id ?? "?",
      };
    }
  }
  return null;
}

/** beforeShellExecution: avalia shell:<comando> contra policies deny. */
export async function enforceShell(input: HookInput): Promise<Record<string, unknown>> {
  const command = input.command ?? "";
  if (!command) {
    return { permission: "allow" };
  }

  const denial = await findDenial([`shell:${command}`]);
  if (denial) {
    return {
      permission: "deny",
      user_message: `Agent OS bloqueou o comando (policy ${denial.policyId}): ${denial.reason}`,
      agent_message:
        `Comando bloqueado por policy do Agent OS: ${denial.reason}. ` +
        "Não tente contornar; consulte check_policy ou peça ao usuário para ajustar a policy.",
    };
  }
  return { permission: "allow" };
}

const FILE_PATH_KEYS = ["path", "file_path", "target_file", "target_notebook"] as const;

function extractFilePath(toolInput: Record<string, unknown> | undefined): string | null {
  if (!toolInput) {
    return null;
  }
  for (const key of FILE_PATH_KEYS) {
    const value = toolInput[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

/** preToolUse (Write/Edit/Delete): avalia write:<path> contra policies deny. */
export async function enforceWrite(input: HookInput): Promise<Record<string, unknown>> {
  const filePath = extractFilePath(input.tool_input);
  if (!filePath) {
    return { permission: "allow" };
  }

  const workspace = resolveWorkspaceRoot(input);
  const denial = await findDenial(writeActionCandidates(filePath, workspace));
  if (denial) {
    return {
      permission: "deny",
      user_message: `Agent OS bloqueou edição de ${filePath} (policy ${denial.policyId}): ${denial.reason}`,
      agent_message:
        `Edição de '${filePath}' bloqueada por policy do Agent OS: ${denial.reason}. ` +
        "Este arquivo é protegido — não tente editá-lo por outros meios.",
    };
  }
  return { permission: "allow" };
}
