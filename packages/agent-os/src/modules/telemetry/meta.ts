/**
 * Extrai dimensões seguras de args de tools proxy (sem payloads).
 * Exportado para testes unitários.
 */
export function extractProxyMeta(
  toolName: string,
  args: unknown,
): { alias?: string; child_tool?: string } {
  if (!args || typeof args !== "object") {
    return {};
  }
  const record = args as Record<string, unknown>;

  if (toolName === "call_mcp_tool") {
    const meta: { alias?: string; child_tool?: string } = {};
    if (typeof record["alias"] === "string") {
      meta.alias = record["alias"];
    }
    if (typeof record["tool_name"] === "string") {
      meta.child_tool = record["tool_name"];
    }
    return meta;
  }

  if (toolName === "call_supabase_tool") {
    const child =
      typeof record["tool_name"] === "string"
        ? record["tool_name"]
        : typeof record["toolName"] === "string"
          ? record["toolName"]
          : undefined;
    return child ? { child_tool: child } : {};
  }

  return {};
}

export function resultLooksLikeError(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }
  return (result as { isError?: boolean }).isError === true;
}
