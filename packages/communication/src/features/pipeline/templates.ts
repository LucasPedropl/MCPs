import { isDelegationEnglish } from "../delegation/delegation-lang.js";
import type { PipelineStepConfig, PipelineStepRole, PromptContext } from "./types.js";

export const DEFAULT_PIPELINE_STEPS: PipelineStepConfig[] = [
  { role: "plan", provider: "antigravity", agentic_mode: false },
  { role: "implement", provider: "antigravity", agentic_mode: true },
  { role: "review", provider: "antigravity", agentic_mode: false },
  { role: "fix", provider: "antigravity", agentic_mode: true },
];

const JSON_FOOTER_EN =  `\n\nEnd with a \`\`\`json block with structured metadata for this role.`;

const JSON_FOOTER_PT =
  `\n\nInclua ao final um bloco \`\`\`json com metadados estruturados conforme o role.`;

const ROLE_BUILDERS_EN: Record<PipelineStepRole, (ctx: PromptContext) => string> = {
  plan: (ctx) =>
    `You are the architect. Create a concise actionable technical plan.\n` +
    `Include: affected files, implementation steps, risks.\n\nTask:\n${ctx.task}` +
    `${JSON_FOOTER_EN}\nJSON: { "files": ["..."], "steps": ["..."], "risks": ["..."], "summary": "..." }`,

  implement: (ctx) =>
    `Implement the task following the plan. Edit files in the workspace.\n\n` +
    `Task:\n${ctx.task}\n\nPlan:\n${ctx.plan ?? "(no plan)"}` +
    `${JSON_FOOTER_EN}\nJSON: { "completed": true, "filesChanged": ["..."], "summary": "..." }`,

  review: (ctx) =>
    `Code review the implementation. List bugs, edge cases, improvements.\n` +
    `Reply in English, be concise.\n\nImplementation:\n${ctx.implement ?? ctx.plan ?? ctx.task}` +
    `${JSON_FOOTER_EN}\nJSON: { "approved": false, "issues": ["..."], "summary": "..." }`,

  fix: (ctx) =>
    `Fix issues from the review. Apply corrections in code.\n\n` +
    `Review:\n${ctx.review ?? "(no review)"}\n\nImplementation context:\n${ctx.implement ?? ctx.task}` +
    `${JSON_FOOTER_EN}\nJSON: { "fixed": true, "changes": ["..."], "summary": "..." }`,
};

const ROLE_BUILDERS_PT: Record<PipelineStepRole, (ctx: PromptContext) => string> = {
  plan: (ctx) =>
    `Você é o arquiteto. Crie um plano técnico conciso e acionável para a tarefa abaixo.\n` +
    `Inclua: arquivos afetados, passos de implementação e riscos.\n\nTarefa:\n${ctx.task}` +
    `${JSON_FOOTER_PT}\nFormato JSON: { "files": ["..."], "steps": ["..."], "risks": ["..."], "summary": "..." }`,

  implement: (ctx) =>
    `Implemente a tarefa seguindo o plano. Edite arquivos no workspace.\n\n` +
    `Tarefa:\n${ctx.task}\n\nPlano:\n${ctx.plan ?? "(sem plano)"}` +
    `${JSON_FOOTER_PT}\nFormato JSON: { "completed": true, "filesChanged": ["..."], "summary": "..." }`,

  review: (ctx) =>
    `Faça code review da implementação. Liste bugs, edge cases e melhorias.\n` +
    `Resposta concisa em português.\n\nImplementação:\n${ctx.implement ?? ctx.plan ?? ctx.task}` +
    `${JSON_FOOTER_PT}\nFormato JSON: { "approved": false, "issues": ["..."], "summary": "..." }`,

  fix: (ctx) =>
    `Corrija os problemas apontados na review. Aplique as correções no código.\n\n` +
    `Review:\n${ctx.review ?? "(sem review)"}\n\nContexto da implementação:\n${ctx.implement ?? ctx.task}` +
    `${JSON_FOOTER_PT}\nFormato JSON: { "fixed": true, "changes": ["..."], "summary": "..." }`,
};

function getRoleBuilders(): Record<PipelineStepRole, (ctx: PromptContext) => string> {
  return isDelegationEnglish() ? ROLE_BUILDERS_EN : ROLE_BUILDERS_PT;
}

/** Monta prompt de um step com contexto acumulado (EN ou PT conforme BRIDGE_DELEGATION_LANG). */
export function buildStepPrompt(role: PipelineStepRole, ctx: PromptContext): string {
  return getRoleBuilders()[role](ctx);
}

export function updateContextForRole(
  role: PipelineStepRole,
  output: string,
  ctx: PromptContext,
): PromptContext {
  if (role === "plan") return { ...ctx, plan: output };
  if (role === "implement") return { ...ctx, implement: output };
  if (role === "review") return { ...ctx, review: output };
  return ctx;
}
