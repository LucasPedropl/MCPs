/**
 * Compactação de tool docs para reduzir o custo fixo do tools/list.
 * Formato completo: linha-resumo + WHEN TO USE / WHEN NOT / RETURNS / PARAMS / NOTES.
 * Formato compacto: linha-resumo (ou WHEN TO USE quando não há resumo) + RETURNS.
 * PARAMS é redundante com o JSON schema que o cliente já recebe.
 */

const FIELD_PREFIXES = [
  "WHEN TO USE:",
  "WHEN NOT:",
  "RETURNS:",
  "PARAMS:",
  "NOTES:",
] as const;

export function compactToolDoc(doc: string): string {
  const lines = doc.trim().split("\n");
  const sections = new Map<string, string[]>();
  let current = "SUMMARY";

  for (const line of lines) {
    const prefix = FIELD_PREFIXES.find((candidate) =>
      line.trimStart().startsWith(candidate),
    );
    if (prefix) {
      current = prefix;
    }
    const bucket = sections.get(current) ?? [];
    bucket.push(line);
    sections.set(current, bucket);
  }

  const summary = (sections.get("SUMMARY") ?? []).join("\n").trim();
  const whenToUse = (sections.get("WHEN TO USE:") ?? []).join("\n").trim();
  const returns = (sections.get("RETURNS:") ?? []).join("\n").trim();

  const head = summary || whenToUse;
  const compact = [head, returns].filter(Boolean).join("\n").trim();
  return compact || doc.trim();
}
