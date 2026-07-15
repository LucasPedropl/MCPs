import type { ParallelProviderSpec, ParallelTargetProvider, PromptCategory } from "./types.js";

const REVIEW_PATTERN =
  /\b(review|revisar|revisão|code review|audit|auditar|segurança|security)\b/i;
const IMPLEMENT_PATTERN =
  /\b(implement|implementar|criar|create|fix|corrigir|refator|refactor|build|desenvolv)\b/i;
const EXPLAIN_PATTERN =
  /\b(explain|explicar|como funciona|what is|o que é|por que|why|document)\b/i;

/** Classifica o prompt para escolher providers adequados. */
export function classifyPrompt(prompt: string): PromptCategory {
  if (REVIEW_PATTERN.test(prompt)) {
    return "review";
  }
  if (IMPLEMENT_PATTERN.test(prompt)) {
    return "implement";
  }
  if (EXPLAIN_PATTERN.test(prompt)) {
    return "explain";
  }
  return "general";
}

/**
 * Semântica real por categoria (antes todas mapeavam para a mesma lista):
 * - review/explain: leitura — vale rodar os dois e comparar perspectivas;
 * - implement: UM provider só — duas IAs implementando o mesmo prompt no
 *   mesmo repo geram merge duplo/conflito;
 * - general: ambos.
 */
const ROUTE_MAP: Record<PromptCategory, ParallelTargetProvider[]> = {
  review: ["antigravity", "cursor"],
  implement: ["antigravity"],
  explain: ["antigravity", "cursor"],
  general: ["antigravity", "cursor"],
};

/** Seleciona providers com base no tipo de prompt. */
export function routeProviders(prompt: string): ParallelProviderSpec[] {
  const category = classifyPrompt(prompt);
  return ROUTE_MAP[category].map((provider) => ({ provider }));
}

export function getRouteInfo(prompt: string): {
  category: PromptCategory;
  providers: ParallelProviderSpec[];
} {
  const category = classifyPrompt(prompt);
  return { category, providers: ROUTE_MAP[category].map((provider) => ({ provider })) };
}
