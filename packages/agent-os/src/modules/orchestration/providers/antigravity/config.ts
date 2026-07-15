import type { CascadeConversationalConfig } from "../../client/types.js";

/** Paralelismo Antigravity no mesmo repo (subagent em background + worktrees agentic). */
export function isAntigravityParallelEnabled(): boolean {
  const raw = process.env["BRIDGE_ANTIGRAVITY_PARALLEL"];
  if (raw === undefined || raw === "") {
    return true;
  }
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

export function getAntigravityMaxConcurrent(): number {
  const raw = process.env["BRIDGE_ANTIGRAVITY_MAX_CONCURRENT"];
  const parsed = raw ? Number.parseInt(raw, 10) : 4;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 16) : 4;
}

export type PlannerModeParam = "off" | "on" | "default";

export type AntigravityPlannerMode = NonNullable<
  CascadeConversationalConfig["plannerMode"]
>;

/** Mapeia param/env → enum da API Cascade. Default: PLANNING_OFF (executa sem HITL). */
export function resolveAntigravityPlannerMode(
  param?: PlannerModeParam,
): AntigravityPlannerMode {
  const raw = (param ?? process.env["BRIDGE_ANTIGRAVITY_PLANNER_MODE"] ?? "off")
    .trim()
    .toLowerCase();

  if (raw === "on" || raw === "planning_on") {
    return "PLANNING_ON";
  }
  if (raw === "default" || raw === "planning_default") {
    return "DEFAULT";
  }
  return "PLANNING_OFF";
}

/** Valor efetivo default (env ou off) — para bridge_status / features. */
export function getAntigravityPlannerModeDefault(): AntigravityPlannerMode {
  return resolveAntigravityPlannerMode();
}
