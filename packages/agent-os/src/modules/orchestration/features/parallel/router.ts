import { classifyIntent } from "../../routing/heuristics.js";
import type { ParallelProviderSpec, ParallelTargetProvider, PromptCategory } from "./types.js";

/** Classifica o prompt via heurística única (compartilhada com route_for_pedro). */
export function classifyPrompt(prompt: string): PromptCategory {
  switch (classifyIntent(prompt)) {
    case "review":
      return "review";
    case "explain":
      return "explain";
    case "implement":
    case "database":
    case "small_fix":
      return "implement";
    default:
      return "general";
  }
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
