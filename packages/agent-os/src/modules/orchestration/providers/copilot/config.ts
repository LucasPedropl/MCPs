/** Perfil de uso do Copilot — student = tokens limitados, uso leve. */
export type CopilotUsageProfile = "light" | "full";

const LIGHT_TIMEOUT_MS = 60_000;
const FULL_TIMEOUT_MS = 180_000;

/** Resolve perfil via env (padrão: light — plano student). */
export function getCopilotUsageProfile(): CopilotUsageProfile {
  const raw = process.env["BRIDGE_COPILOT_PROFILE"]?.trim().toLowerCase();
  if (raw === "full" || raw === "pro") {
    return "full";
  }
  return "light";
}

export function isCopilotLightMode(): boolean {
  return getCopilotUsageProfile() === "light";
}

export function getCopilotDefaultTimeoutMs(): number {
  return isCopilotLightMode() ? LIGHT_TIMEOUT_MS : FULL_TIMEOUT_MS;
}

/** Modelos econômicos para plano student. */
export const COPILOT_LIGHT_MODELS = ["auto", "gpt-5.4-mini", "gpt-5-mini", "claude-haiku-4.5"] as const;
