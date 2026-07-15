import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function jsonText(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function errorText(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export function markdownText(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

// ── guard de tamanho (proxies que devolvem payloads arbitrários) ─────────────

export const DEFAULT_GUARD_MAX_CHARS = 50_000;

/** Estimativa barata (~4 chars/token) para relatórios de truncamento. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TruncateOptions {
  maxChars: number;
  /** Sufixo com instrução específica da tool (ex: como paginar). */
  hint?: string;
  /** Fração do cap reservada para o head (restante vai para o tail). */
  headRatio?: number;
}

/**
 * Trunca mantendo head+tail com marcador explícito. maxChars <= 0 desliga.
 * O marcador avisa que JSON pode estar cortado no meio — re-chamar, não parsear.
 */
export function truncateWithHint(text: string, options: TruncateOptions): string {
  const { maxChars, hint = "", headRatio = 0.8 } = options;
  if (maxChars <= 0 || text.length <= maxChars) {
    return text;
  }

  const marker =
    `\n\n[agent-os guard] TRUNCATED: result was ${text.length} chars ` +
    `(~${estimateTokens(text)} tokens), cap is ${maxChars}. Kept head+tail; ` +
    `JSON may be cut mid-structure. Re-call with narrower arguments ` +
    `(filters, pagination, fields)${hint}. Or pass max_chars to raise the cap.\n\n`;

  const budget = Math.max(maxChars - marker.length, 200);
  const headLen = Math.floor(budget * headRatio);
  const tailLen = budget - headLen;

  return text.slice(0, headLen) + marker + text.slice(text.length - tailLen);
}

export interface GuardOptions {
  maxChars?: number;
  hint?: string;
  headRatio?: number;
}

/**
 * Serializa compacto (sem pretty-print — 10-30% menor) e aplica o guard.
 * Para tools proxy cujo resultado vem de fora e pode ser enorme.
 * Tools de admin/export devem continuar em jsonText (sem truncamento silencioso).
 */
export function guardedJsonText(data: unknown, options: GuardOptions = {}): CallToolResult {
  const { maxChars = DEFAULT_GUARD_MAX_CHARS, hint, headRatio } = options;
  const raw = typeof data === "string" ? data : JSON.stringify(data);
  const guardOptions: TruncateOptions = { maxChars };
  if (hint !== undefined) guardOptions.hint = hint;
  if (headRatio !== undefined) guardOptions.headRatio = headRatio;
  return {
    content: [{ type: "text", text: truncateWithHint(raw, guardOptions) }],
  };
}
