import type { ModelEnum } from "../../client/types.js";

// ---------------------------------------------------------------------------
// Task Category Enum
// ---------------------------------------------------------------------------

/**
 * Categorias de tarefa para roteamento inteligente de modelos.
 *
 * Cada categoria direciona para um pool/modelo otimizado:
 * - Tarefas leves → Gemini fast
 * - Implementação → Gemini pro
 * - Review/Refactor → Claude sonnet
 * - Arquitetura → Claude opus
 * - General → GPT medium
 */
export const TaskCategory = {
  Summarize: "summarize",
  Implement: "implement",
  Review: "review",
  Refactor: "refactor",
  Architecture: "architecture",
  Probe: "probe",
  Debug: "debug",
  Test: "test",
  General: "general",
} as const;

export type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory];

// ---------------------------------------------------------------------------
// Model Pool
// ---------------------------------------------------------------------------

/** Pool de créditos Antigravity — Gemini vs modelos externos. */
export type AntigravityModelPool = "gemini" | "claude" | "gpt";

// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------

const GEMINI_MODELS = {
  fast: "MODEL_PLACEHOLDER_M132" as ModelEnum,
  balanced: "MODEL_PLACEHOLDER_M20" as ModelEnum,
  pro: "MODEL_PLACEHOLDER_M16" as ModelEnum,
  proLow: "MODEL_PLACEHOLDER_M36" as ModelEnum,
} as const;

const CLAUDE_MODELS = {
  sonnet: "MODEL_PLACEHOLDER_M35" as ModelEnum,
  opus: "MODEL_PLACEHOLDER_M26" as ModelEnum,
} as const;

const GPT_MODELS = {
  medium: "MODEL_OPENAI_GPT_OSS_120B_MEDIUM" as ModelEnum,
} as const;

/** Mapa de categoria → modelo padrão. */
const CATEGORY_MODEL_MAP: Record<TaskCategory, ModelEnum> = {
  [TaskCategory.Summarize]: GEMINI_MODELS.fast,
  [TaskCategory.Probe]: GEMINI_MODELS.fast,
  [TaskCategory.Implement]: GEMINI_MODELS.pro,
  [TaskCategory.Debug]: GEMINI_MODELS.pro,
  [TaskCategory.Test]: GEMINI_MODELS.balanced,
  [TaskCategory.Review]: CLAUDE_MODELS.sonnet,
  [TaskCategory.Refactor]: CLAUDE_MODELS.sonnet,
  [TaskCategory.Architecture]: CLAUDE_MODELS.opus,
  [TaskCategory.General]: GPT_MODELS.medium,
};

// ---------------------------------------------------------------------------
// Model Routing
// ---------------------------------------------------------------------------

/**
 * Seleciona modelo ideal baseado na categoria da tarefa.
 *
 * Distribui entre os pools Gemini/Claude/GPT para otimizar uso de créditos:
 * - **Gemini pool**: summarize, probe, implement, debug, test
 * - **Claude pool**: review, refactor, architecture
 * - **GPT pool**: general
 */
export function pickAntigravityModel(category: TaskCategory): ModelEnum {
  return CATEGORY_MODEL_MAP[category] ?? GEMINI_MODELS.balanced;
}

/**
 * Identifica a qual pool um modelo pertence.
 * Usado para tracking de consumo e balanceamento.
 */
export function getModelPool(model: ModelEnum): AntigravityModelPool {
  const modelStr = String(model).toUpperCase();

  if (
    modelStr.includes("CLAUDE") ||
    modelStr === "MODEL_PLACEHOLDER_M35" ||
    modelStr === "MODEL_PLACEHOLDER_M26"
  ) {
    return "claude";
  }

  if (modelStr.includes("GPT") || modelStr.includes("OPENAI")) {
    return "gpt";
  }

  return "gemini";
}

// ---------------------------------------------------------------------------
// Task Category Inference
// ---------------------------------------------------------------------------

/** Pares regex → categoria para inferência automática. */
const INFERENCE_RULES: ReadonlyArray<{ pattern: RegExp; category: TaskCategory }> = [
  {
    pattern: /\b(compress|resumir|summarize|truncar|sintetizar|tl;?dr)\b/i,
    category: TaskCategory.Summarize,
  },
  {
    pattern: /\b(review|revisar|audit|code\s*review|avaliar\s*código)\b/i,
    category: TaskCategory.Review,
  },
  {
    pattern: /\b(test|testar|unit\s*test|e2e|cobertura|coverage)\b/i,
    category: TaskCategory.Test,
  },
  {
    pattern: /\b(debug|depurar|investigar|traceback|stack\s*trace)\b/i,
    category: TaskCategory.Debug,
  },
  {
    pattern: /\b(refactor|refatorar|adapter|interface|extrair|extract)\b/i,
    category: TaskCategory.Refactor,
  },
  {
    pattern: /\b(arquitet|design|webhook|realtime|edge\s*function|schema|migra)/i,
    category: TaskCategory.Architecture,
  },
  {
    pattern: /\b(list.*model|probe|models\s*--help|discovery)\b/i,
    category: TaskCategory.Probe,
  },
];

/**
 * Infere categoria de tarefa a partir do prompt.
 *
 * Prioridade:
 * 1. Match por regex das regras de inferência
 * 2. Se agentic → implement (presume criação/edição)
 * 3. Fallback → general
 */
export function inferTaskCategory(
  prompt: string,
  agentic: boolean,
): TaskCategory {
  const lower = prompt.toLowerCase();

  for (const rule of INFERENCE_RULES) {
    if (rule.pattern.test(lower)) {
      return rule.category;
    }
  }

  if (agentic || /\b(implement|criar|fix|corrigir|editar|write|escrever)\b/i.test(lower)) {
    return TaskCategory.Implement;
  }

  return TaskCategory.General;
}

// ---------------------------------------------------------------------------
// Public Resolver
// ---------------------------------------------------------------------------

/** Informações de roteamento resolvidas. */
export interface ModelRouteResult {
  model: ModelEnum;
  category: TaskCategory;
  pool: AntigravityModelPool;
  explicit: boolean;
}

/**
 * Resolve modelo final: explícito > auto-rota por categoria.
 *
 * @param prompt - Texto do prompt para inferência
 * @param agentic - Se o modo agentic está ativo
 * @param explicitModel - Modelo solicitado explicitamente (bypass auto-rota)
 * @returns Informações completas de roteamento
 */
export function resolveAntigravityModel(
  prompt: string,
  agentic: boolean,
  explicitModel?: string,
): ModelRouteResult {
  if (explicitModel?.trim()) {
    const model = explicitModel as ModelEnum;
    return {
      model,
      category: TaskCategory.General,
      pool: getModelPool(model),
      explicit: true,
    };
  }

  const category = inferTaskCategory(prompt, agentic);
  const model = pickAntigravityModel(category);

  return {
    model,
    category,
    pool: getModelPool(model),
    explicit: false,
  };
}
