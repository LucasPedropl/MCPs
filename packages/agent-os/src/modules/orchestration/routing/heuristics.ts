/**
 * Heurística ÚNICA de classificação de intenção — consumida por
 * route_for_pedro, suggestProvider (assemble_context) e classifyPrompt
 * (delegação paralela). Antes eram 3 regexes divergentes com recomendações
 * contraditórias.
 */
export type IntentCategory =
  | "database"
  | "review"
  | "implement"
  | "small_fix"
  | "explain"
  | "general";

const DATABASE_PATTERN =
  /(migration|migração|rls|sql|supabase|schema|policy|política|banco)/i;
const REVIEW_PATTERN =
  /\b(review|revisar|revisão|code review|audit|auditar|auditoria|segurança|security)\b/i;
const IMPLEMENT_PATTERN =
  /(feature|implement|implementar|criar|create|refactor|refatora|arquitetura|architecture|large|grande|testes|tests|build|desenvolv)/i;
const SMALL_FIX_PATTERN = /\b(bug|fix|corrigir|typo|small|quick|rápid)/i;
const EXPLAIN_PATTERN =
  /\b(explain|explicar|como funciona|what is|o que é|por que|why|document)\b/i;

export function classifyIntent(intent: string): IntentCategory {
  if (DATABASE_PATTERN.test(intent)) {
    return "database";
  }
  if (REVIEW_PATTERN.test(intent)) {
    return "review";
  }
  if (IMPLEMENT_PATTERN.test(intent)) {
    return "implement";
  }
  if (SMALL_FIX_PATTERN.test(intent)) {
    return "small_fix";
  }
  if (EXPLAIN_PATTERN.test(intent)) {
    return "explain";
  }
  return "general";
}

/** Provider recomendado por categoria (undefined = sem recomendação forte). */
export function suggestProviderForIntent(
  intent: string,
): "cursor" | "antigravity" | undefined {
  switch (classifyIntent(intent)) {
    case "database":
    case "small_fix":
      return "cursor";
    case "implement":
    case "review":
      return "antigravity";
    default:
      return undefined;
  }
}
