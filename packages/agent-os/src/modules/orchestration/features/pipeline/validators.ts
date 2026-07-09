import { z } from "zod";
import type { PipelineStepRole } from "./types.js";

export const planOutputSchema = z.object({
  files: z.array(z.string()).min(1),
  steps: z.array(z.string()).min(1),
  risks: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const implementOutputSchema = z.object({
  completed: z.boolean(),
  filesChanged: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const reviewOutputSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()).default([]),
  summary: z.string().optional(),
});

export const fixOutputSchema = z.object({
  fixed: z.boolean(),
  changes: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

const SCHEMA_BY_ROLE: Record<PipelineStepRole, z.ZodType> = {
  plan: planOutputSchema,
  implement: implementOutputSchema,
  review: reviewOutputSchema,
  fix: fixOutputSchema,
};

export type PlanOutput = z.infer<typeof planOutputSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;

export interface StepValidationResult {
  valid: boolean;
  parsed?: unknown;
  errors?: string[];
  raw: string;
}

/** Extrai bloco JSON de markdown na resposta do LLM (tenta todos os blocos). */
function extractJsonBlock(text: string): unknown | null {
  const pattern = /```(?:json)?\s*\n?([\s\S]*?)```/gi;
  for (const match of text.matchAll(pattern)) {
    const block = match[1]?.trim();
    if (!block) {
      continue;
    }
    try {
      return JSON.parse(block) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}

function heuristicValidate(role: PipelineStepRole, text: string): StepValidationResult {
  const trimmed = text.trim();
  if (trimmed.length < 30) {
    return { valid: false, errors: ["Output muito curto para o step"], raw: text };
  }

  if (role === "review") {
    const approved =
      /\b(lgtm|aprovado|sem problemas|no issues|approved|looks good)\b/i.test(trimmed);
    const hasIssues = /\b(bug|erro|issue|problema|critical|must fix|corrigir)\b/i.test(trimmed);
    return {
      valid: true,
      parsed: {
        approved: approved && !hasIssues,
        issues: hasIssues ? ["issues detectados heuristicamente"] : [],
      } satisfies ReviewOutput,
      raw: text,
    };
  }

  if (role === "plan" && trimmed.length < 80) {
    return { valid: false, errors: ["Plano muito curto"], raw: text };
  }

  return { valid: true, raw: text };
}

/** Valida output de um step do pipeline (JSON estruturado ou heurística). */
export function validateStepOutput(role: PipelineStepRole, output: string): StepValidationResult {
  const schema = SCHEMA_BY_ROLE[role];
  const json = extractJsonBlock(output);

  if (json !== null) {
    const result = schema.safeParse(json);
    if (result.success) {
      return { valid: true, parsed: result.data, raw: output };
    }
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      raw: output,
    };
  }

  return heuristicValidate(role, output);
}

/** Indica se a review exige mais um ciclo fix. */
export function reviewNeedsFix(validation: StepValidationResult): boolean {
  const parsed = validation.parsed as ReviewOutput | undefined;
  if (parsed?.approved === true) {
    return false;
  }
  if (parsed?.approved === false) {
    return true;
  }
  if (parsed?.issues && parsed.issues.length > 0) {
    return true;
  }
  return /\b(bug|erro|issue|problema|must fix|corrigir|falha)\b/i.test(validation.raw);
}

export const MAX_REVIEW_FIX_LOOPS = 2;
