interface CopilotJsonEvent {
  type?: string;
  data?: {
    content?: string;
    messageId?: string;
    sessionId?: string;
    model?: string;
    phase?: string;
  };
  sessionId?: string;
}

const TOOL_LINE = /^[●◦▪]\s|^(Read|Search|List|Write|Shell|Glob|Grep)\b/i;

/** Extrai resposta final de stdout JSONL do Copilot CLI. */
export function parseCopilotJsonOutput(stdout: string): {
  response: string;
  sessionId?: string;
  model?: string;
} {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  let response = "";
  let sessionId: string | undefined;
  let model: string | undefined;

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as CopilotJsonEvent;
      if (event.type === "result" && event.sessionId) {
        sessionId = event.sessionId;
      }
      if (event.type === "assistant.message" && event.data?.content) {
        if (event.data.phase === "final_answer" || !response) {
          response = event.data.content;
          model = event.data.model ?? model;
        }
      }
    } catch {
      // linha não-JSON — ignorar
    }
  }

  return { response: response.trim(), sessionId, model };
}

/** Remove narração de tools do stdout em modo texto. */
export function stripCopilotToolNarration(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let inToolBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!inToolBlock && kept.length > 0) {
        kept.push("");
      }
      continue;
    }
    if (TOOL_LINE.test(trimmed) || trimmed.startsWith("└")) {
      inToolBlock = true;
      continue;
    }
    if (trimmed.startsWith("Explorando") || trimmed.startsWith("Agora vou")) {
      inToolBlock = true;
      continue;
    }
    inToolBlock = false;
    kept.push(line);
  }

  const cleaned = kept.join("\n").trim();
  return cleaned || text.trim();
}

/** Parse unificado: JSONL preferencial, fallback texto limpo. */
export function parseCopilotStdout(stdout: string, usedJsonFormat: boolean): {
  response: string;
  sessionId?: string;
  model?: string;
} {
  if (usedJsonFormat) {
    const parsed = parseCopilotJsonOutput(stdout);
    if (parsed.response) {
      return parsed;
    }
  }
  return { response: stripCopilotToolNarration(stdout) };
}
