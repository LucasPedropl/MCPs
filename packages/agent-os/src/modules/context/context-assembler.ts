import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentHost, AssembledContext, BridgeProvider } from "@mcps/shared";
import { getAgentOsConfigDir } from "../../config/env.js";
import { recallMemory } from "../memory/memory-store.js";
import { slimMemoryRecall } from "../memory/memory-slim.js";
import { getProjectProfile } from "../bootstrap/bootstrap-service.js";
import { resolveSkills } from "../knowledge/knowledge-store.js";

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function chunkText(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars)}\n\n...[truncated]`;
}

function cacheKey(workspace: string, intent: string): string {
  return crypto
    .createHash("sha256")
    .update(`${workspace}::${intent}`)
    .digest("hex");
}

function readCache(workspace: string, intent: string): AssembledContext | null {
  const cacheDir = path.join(getAgentOsConfigDir(), "cache", "context");
  const filePath = path.join(cacheDir, `${cacheKey(workspace, intent)}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as AssembledContext;
  } catch {
    return null;
  }
}

function writeCache(workspace: string, intent: string, payload: AssembledContext): void {
  const cacheDir = path.join(getAgentOsConfigDir(), "cache", "context");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, `${cacheKey(workspace, intent)}.json`),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

function suggestProvider(intent: string): BridgeProvider | undefined {
  const lower = intent.toLowerCase();
  if (/(migration|migração|rls|sql|supabase|schema|banco)/.test(lower)) {
    return "cursor";
  }
  if (/(feature|implement|implementar|refactor|refatora|large|grande|testes)/.test(lower)) {
    return "antigravity";
  }
  if (/(bug|fix|corrigir|small|typo|rápid)/.test(lower)) {
    return "cursor";
  }
  return undefined;
}

export async function assembleContext(input: {
  intent: string;
  workspace: string;
  host?: AgentHost;
  tokenBudget?: number;
  useCache?: boolean;
}): Promise<AssembledContext> {
  const budget = input.tokenBudget ?? 8000;
  const workspace = path.resolve(input.workspace);

  if (input.useCache !== false) {
    const cached = readCache(workspace, input.intent);
    if (cached) {
      return cached;
    }
  }

  const memoryBudget = Math.floor(budget * 0.3);
  const skillsBudget = Math.floor(budget * 0.4);
  const schemaBudget = Math.floor(budget * 0.2);
  const playbookBudget = budget - memoryBudget - skillsBudget - schemaBudget;

  const memory = await recallMemory({
    intent: input.intent,
    workspacePath: workspace,
    limit: 8,
  });

  const slimMemory = slimMemoryRecall({
    preferences: memory.preferences,
    decisions: memory.decisions,
    pitfalls: memory.pitfalls,
  });

  const skills = await resolveSkills({
    intent: input.intent,
    workspacePath: workspace,
    limit: 3,
  });

  const profile = await getProjectProfile(workspace);

  const preferences = slimMemory.preferences;
  const decisions = slimMemory.decisions;
  const pitfalls = slimMemory.pitfalls;

  const skillChunks = skills.map((skill) => ({
    name: skill.name,
    chunk: chunkText(skill.content_md, skillsBudget * CHARS_PER_TOKEN),
  }));

  const playbookChunks: Array<{ server: string; chunk: string }> = [];
  if (profile?.bundle_json) {
    const bundleText = JSON.stringify(profile.bundle_json);
    playbookChunks.push({
      server: "project_bundle",
      chunk: chunkText(bundleText, playbookBudget * CHARS_PER_TOKEN),
    });
  }

  const suggestedTools = [
    "bootstrap_project",
    "assemble_context",
    "recall_for_task",
    "route_for_pedro",
    "list_connected_mcps",
    "call_mcp_tool",
    "run_quality_gates",
  ];

  if (/(sql|migration|supabase|rls)/i.test(input.intent)) {
    suggestedTools.push("switch_project", "execute_sql", "schema_context_for_task");
  }

  const payload: AssembledContext = {
    preferences,
    decisions,
    pitfalls,
    skills: skillChunks,
    playbooks: playbookChunks,
    suggested_tools: suggestedTools,
    suggested_provider: suggestProvider(input.intent),
    token_estimate: 0,
  };

  const serialized = JSON.stringify(payload);
  payload.token_estimate = estimateTokens(serialized);

  if (payload.token_estimate > budget) {
    payload.skills = payload.skills.map((skill) => ({
      ...skill,
      chunk: chunkText(skill.chunk, Math.floor((skillsBudget * CHARS_PER_TOKEN) / 2)),
    }));
    payload.token_estimate = estimateTokens(JSON.stringify(payload));
  }

  writeCache(workspace, input.intent, payload);
  return payload;
}
