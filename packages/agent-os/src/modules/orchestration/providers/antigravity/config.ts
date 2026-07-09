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
