/**
 * Detecta respostas do Antigravity que pedem confirmação do plano
 * em vez de executar (Planning Mode HITL).
 */

const AWAITING_PATTERNS: RegExp[] = [
  /\bplease\s+confirm\b/i,
  /\bconfirm\s+(to\s+)?(proceed|continue|implement|the\s+plan)\b/i,
  /\bshall\s+i\s+(proceed|continue|implement|start)\b/i,
  /\bready\s+to\s+implement\b/i,
  /\bawaiting\s+(your\s+)?(confirmation|approval|go[- ]?ahead)\b/i,
  /\bdo\s+you\s+(want|approve|confirm)\b/i,
  /\b(approve|approval)\s+(the\s+)?plan\b/i,
  /\blet\s+me\s+know\s+if\s+(you('|’)d\s+like|i\s+should)\b/i,
  /\bwaiting\s+for\s+(your\s+)?(confirmation|approval)\b/i,
  /\bposso\s+continuar\b/i,
  /\bconfirma(r)?\s+(o\s+)?plano\b/i,
  /\baguardo\s+(sua\s+)?(confirmação|aprovação|aprovacao)\b/i,
  /\b(aprov(e|ar)|confirma)\s+(para\s+)?(eu\s+)?(prosseguir|implementar|continuar)\b/i,
  /\bdeseja\s+que\s+eu\s+(implemente|prossiga|continue)\b/i,
  /\bposso\s+(começar|comecar|implementar|prosseguir)\b/i,
];

const DONE_PATTERNS: RegExp[] = [
  /\b(implemented|implementation)\s+(successfully|complete|done)\b/i,
  /\b(all\s+)?(changes|edits|files)\s+(have\s+been|were)\s+(made|applied|written)\b/i,
  /\bSMOKE_OK\b/,
  /\btask\s+(is\s+)?(complete|done|finished)\b/i,
  /\b(tarefa|implementação|implementacao)\s+(concluída|concluida|finalizada|pronta)\b/i,
  /\barquivos?\s+(foram\s+)?(editados|criados|alterados)\b/i,
];

export const APPROVE_PLAN_PROMPT =
  "Approved. Implement the plan now. Do not ask for further confirmation.";

export const REJECT_PLAN_PROMPT =
  "Rejected. Do not implement the plan. Stop and wait for a new task.";

export const AWAITING_PLAN_HINT =
  "Use continue_session with approve_plan=true (or an approval prompt) on the same cascade/session to execute.";

/** True quando o texto parece um plano parado pedindo confirmação humana. */
export function isAwaitingPlanApproval(response: string): boolean {
  const text = response.trim();
  if (text.length < 40) {
    return false;
  }

  if (DONE_PATTERNS.some((re) => re.test(text))) {
    return false;
  }

  return AWAITING_PATTERNS.some((re) => re.test(text));
}
