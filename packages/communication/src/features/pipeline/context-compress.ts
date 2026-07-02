import { PromptContext } from "./types.js";

/**
 * Comprime a saída de um passo mantendo o início e o fim.
 * 
 * @param role Papel/Nome do passo
 * @param output Conteúdo a ser comprimido
 * @param maxChars Número máximo de caracteres permitidos
 * @returns String comprimida
 */
export function compressStepOutput(role: string, output: string, maxChars: number = 4000): string {
  if (!output || typeof output !== "string") {
    return output;
  }

  if (output.length <= maxChars || role === "task") {
    return output;
  }

  const message = `\n\n... [TRUNCADO] ...\n\n`;
  const charsToKeep = maxChars - message.length;

  if (charsToKeep <= 0) {
    return output.substring(0, maxChars);
  }

  const keepStart = Math.ceil(charsToKeep / 2);
  const keepEnd = Math.floor(charsToKeep / 2);

  const startPart = output.substring(0, keepStart);
  const endPart = output.substring(output.length - keepEnd);

  return `${startPart}${message}${endPart}`;
}

/**
 * Comprime o contexto do pipeline limitando o tamanho total aproximado.
 * Preserva a task original intacta e trunca plan, implement e review proporcionalmente.
 * 
 * @param ctx Contexto original do Prompt
 * @param maxChars Limite máximo de caracteres globais
 * @returns Novo contexto comprimido
 */
export function compressPipelineContext(ctx: PromptContext, maxChars: number = 8000): PromptContext {
  const result: PromptContext = {
    task: ctx.task,
  };

  const fields: (keyof Omit<PromptContext, "task">)[] = ["plan", "implement", "review"];
  
  const presentFields = fields.filter(
    (field) => typeof ctx[field] === "string" && ctx[field]!.length > 0
  );

  if (presentFields.length === 0) {
    return result;
  }

  const taskLength = ctx.task?.length ?? 0;
  // Garantimos pelo menos 300 caracteres por campo extra, para nunca eliminar tudo
  const minBudgetPerField = 300;
  const remainingBudget = Math.max(
    minBudgetPerField * presentFields.length,
    maxChars - taskLength
  );
  
  const budgetPerField = Math.floor(remainingBudget / presentFields.length);

  for (const field of presentFields) {
    const content = ctx[field];
    if (content) {
      result[field] = compressStepOutput(field, content, budgetPerField);
    }
  }

  return result;
}
