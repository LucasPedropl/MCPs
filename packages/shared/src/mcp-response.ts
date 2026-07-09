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
