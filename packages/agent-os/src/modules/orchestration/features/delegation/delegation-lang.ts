import { agentOsEnv } from "../../../../config/env.js";
import type { BridgeProvider } from "../../client/types.js";

export type DelegationLang = "en" | "pt";

/** ~6 tokens — menor overhead possível que ainda força resposta EN. */
const EN_PREFIX = "Reply in English. Be concise.\n\n";

/**
 * Idioma inter-agente (orquestrador ↔ Antigravity).
 * Default `en` — inglês tokeniza ~15–25% mais barato que PT nos modelos atuais.
 * Env: AGENT_OS_DELEGATION_LANG=en|pt (legado: BRIDGE_DELEGATION_LANG)
 */
export function getDelegationLang(): DelegationLang {
  const raw = agentOsEnv("DELEGATION_LANG")?.toLowerCase();
  if (raw === "pt" || raw === "pt-br" || raw === "portuguese") {
    return "pt";
  }
  return "en";
}

export function isDelegationEnglish(): boolean {
  return getDelegationLang() === "en";
}

/** Aplica prefixo EN idempotente antes de enviar ao Antigravity. */
export function prepareAntigravityPrompt(prompt: string): string {
  if (!isDelegationEnglish()) {
    return prompt;
  }
  if (prompt.startsWith("Reply in English")) {
    return prompt;
  }
  return `${EN_PREFIX}${prompt}`;
}

/** Wrap opcional para todos os providers (BRIDGE_DELEGATION_LANG_ALL=1). */
export function prepareProviderPrompt(prompt: string, provider: BridgeProvider): string {
  if (provider === "antigravity") {
    return prepareAntigravityPrompt(prompt);
  }
  if (agentOsEnv("DELEGATION_LANG_ALL") === "1" && isDelegationEnglish()) {
    return prepareAntigravityPrompt(prompt);
  }
  return prompt;
}

export function getDelegationLangHint(): string {
  const lang = getDelegationLang();
  const all = agentOsEnv("DELEGATION_LANG_ALL") === "1";
  if (lang === "en") {
    return all
      ? "Inter-agent EN (all providers) — ~15–25% token savings vs PT"
      : "Inter-agent EN (Antigravity + pipeline) — orchestrator should delegate in English";
  }
  return "Inter-agent PT — no EN prefix on delegated prompts";
}
