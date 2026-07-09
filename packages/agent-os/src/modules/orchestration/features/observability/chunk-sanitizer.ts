/** Redige padrões sensíveis antes de persistir chunks no Supabase. */
const SECRET_PATTERNS: RegExp[] = [
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(ghp_[a-zA-Z0-9]{36,})\b/g,
  /\b(gho_[a-zA-Z0-9]{36,})\b/g,
  /\b(github_pat_[a-zA-Z0-9_]{20,})\b/g,
  /\b(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g,
  /(?:api[_-]?key|secret|token|password|passwd|authorization)\s*[:=]\s*['"]?[a-zA-Z0-9_\-./+=]{8,}/gi,
  /Bearer\s+[a-zA-Z0-9_\-./+=]{10,}/gi,
];

const ENV_LINE = /^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/;

export function sanitizeChunkText(text: string): string {
  let output = text;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }

  return output
    .split(/\r?\n/)
    .map((line) => {
      const match = ENV_LINE.exec(line.trim());
      if (!match) {
        return line;
      }
      const key = match[1] ?? "";
      if (/KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE/i.test(key)) {
        return `${key}=[REDACTED]`;
      }
      return line;
    })
    .join("\n");
}
