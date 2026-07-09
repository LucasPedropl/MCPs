import type { DelegationSessionRow, SharedContextRow } from "./types.js";

/** Monta prompt enriquecido com histórico da sessão e context pack. */
export function buildContextPackPrompt(
  session: DelegationSessionRow,
  newPrompt: string,
  contextItems: SharedContextRow[],
): string {
  const sections: string[] = [];

  if (contextItems.length > 0) {
    const pack = contextItems
      .map((item) => {
        const label = item.label ? `[${item.label}]` : "[context]";
        return `${label}\n${item.content}`;
      })
      .join("\n\n---\n\n");
    sections.push(`## Context Pack\n${pack}`);
  }

  if (session.last_prompt && session.last_response) {
    sections.push(
      `## Previous Turn (${session.provider})\n` +
        `User: ${session.last_prompt}\n\nAssistant: ${session.last_response}`,
    );
  }

  sections.push(`## Current Request\n${newPrompt}`);

  return sections.join("\n\n");
}
