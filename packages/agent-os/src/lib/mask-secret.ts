/** Mascara segredos para exibição em tools MCP (ex: eyJhbG...xpY). */
export function maskSecret(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return "***";
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/** Redact env vars sensíveis em config JSON de MCP. */
export function redactMcpConfig(config: Record<string, unknown>): Record<string, unknown> {
  const cloned = structuredClone(config);
  const env = cloned.env;
  if (env && typeof env === "object" && !Array.isArray(env)) {
    const envRecord = env as Record<string, string>;
    for (const key of Object.keys(envRecord)) {
      if (/token|key|secret|password|pat|auth/i.test(key)) {
        envRecord[key] = maskSecret(envRecord[key]) ?? "***";
      }
    }
  }

  const headers = cloned.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const headerRecord = headers as Record<string, string>;
    for (const key of Object.keys(headerRecord)) {
      if (/authorization|apikey|api-key|token/i.test(key)) {
        headerRecord[key] = maskSecret(headerRecord[key]) ?? "***";
      }
    }
  }

  return cloned;
}
