/**
 * Filtro opcional de superfície de tools por cliente, via envs
 * AGENT_OS_TOOLS_ALLOW / AGENT_OS_TOOLS_DENY (csv) no mcp.json.
 * Sem filtro setado, nada é patchado. Tools ocultas não são registradas
 * (não entram no tools/list do cliente).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getToolFilter, type ToolFilter } from "../config/env.js";

/** Nunca ocultas: status e o lookup de docs sob demanda. */
export const ALWAYS_VISIBLE = new Set(["agent_os_status", "get_usage_guide"]);

const hiddenTools = new Set<string>();

export function isToolHidden(
  name: string,
  filter: ToolFilter = getToolFilter(),
): boolean {
  if (!filter.active) {
    return false;
  }
  if (ALWAYS_VISIBLE.has(name)) {
    return false;
  }
  if (filter.deny.has(name)) {
    return true;
  }
  if (filter.allow.size > 0 && !filter.allow.has(name)) {
    return true;
  }
  return false;
}

/** Tools efetivamente ocultadas durante o registro (para agent_os_status). */
export function listHiddenTools(): string[] {
  return [...hiddenTools].sort();
}

type AnyFn = (...args: unknown[]) => unknown;

/** Stub inerte devolvido no lugar do RegisteredTool (nenhum caller usa o retorno). */
const inertRegisteredTool = {
  enabled: false,
  enable: () => {},
  disable: () => {},
  update: () => {},
  remove: () => {},
};

/**
 * Monkey-patch de server.registerTool E server.tool (orquestração usa a API
 * legada) — deve rodar ANTES de qualquer registro de tool.
 */
export function applyToolFilter(server: McpServer): void {
  const filter = getToolFilter();
  if (!filter.active) {
    return;
  }

  const target = server as unknown as Record<string, AnyFn>;
  for (const method of ["registerTool", "tool"] as const) {
    const original = target[method];
    if (typeof original !== "function") {
      continue;
    }
    const bound = original.bind(server) as AnyFn;
    target[method] = (...args: unknown[]) => {
      const name = args[0];
      if (typeof name === "string" && isToolHidden(name, filter)) {
        hiddenTools.add(name);
        console.error(
          `[agent-os] tool '${name}' oculta via AGENT_OS_TOOLS_ALLOW/DENY.`,
        );
        return inertRegisteredTool;
      }
      return bound(...args);
    };
  }
}
