/**
 * Monkey-patch de server.registerTool e server.tool para telemetria de tools/call.
 * Deve rodar ANTES de qualquer registro (depois de applyToolFilter).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAgentOsHost,
  isTelemetryEnabled,
} from "../config/env.js";
import { recordToolEvent } from "../modules/telemetry/event-store.js";
import {
  extractProxyMeta,
  resultLooksLikeError,
} from "../modules/telemetry/meta.js";

const EXCLUDED_FROM_RECORDING = new Set(["mcp_usage_stats"]);

const registeredTools = new Set<string>();
const toolModules = new Map<string, string>();

let registeringModule: string | null = null;

type AnyFn = (...args: unknown[]) => unknown;

export function setRegisteringModule(moduleName: string | null): void {
  registeringModule = moduleName;
}

export function listRegisteredTools(): string[] {
  return [...registeredTools].sort();
}

export function getToolModule(toolName: string): string | null {
  return toolModules.get(toolName) ?? null;
}

function findLastFunctionIndex(args: unknown[]): number {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (typeof args[index] === "function") {
      return index;
    }
  }
  return -1;
}

function wrapToolHandler(toolName: string, original: AnyFn): AnyFn {
  return async (...handlerArgs: unknown[]) => {
    const startedAt = Date.now();
    const callArgs = handlerArgs[0];
    const meta = extractProxyMeta(toolName, callArgs);
    const moduleName = toolModules.get(toolName) ?? null;
    const host = getAgentOsHost();

    const record = (ok: boolean) => {
      if (!isTelemetryEnabled() || EXCLUDED_FROM_RECORDING.has(toolName)) {
        return;
      }
      void recordToolEvent({
        tool_name: toolName,
        host,
        ok,
        duration_ms: Date.now() - startedAt,
        module: moduleName,
        meta,
      });
    };

    try {
      const result = await Promise.resolve(original(...handlerArgs));
      record(!resultLooksLikeError(result));
      return result;
    } catch (error: unknown) {
      record(false);
      throw error;
    }
  };
}

/**
 * Instrumenta registerTool/tool. Sempre patcha (para catalogar registered tools);
 * a gravação respeita AGENT_OS_TELEMETRY=0.
 */
export function applyToolTelemetry(server: McpServer): void {
  const target = server as unknown as Record<string, AnyFn>;
  for (const method of ["registerTool", "tool"] as const) {
    const original = target[method];
    if (typeof original !== "function") {
      continue;
    }
    const bound = original.bind(server) as AnyFn;
    target[method] = (...args: unknown[]) => {
      const name = args[0];
      if (typeof name === "string") {
        registeredTools.add(name);
        if (registeringModule) {
          toolModules.set(name, registeringModule);
        }
        const callbackIndex = findLastFunctionIndex(args);
        if (callbackIndex >= 0) {
          const callback = args[callbackIndex];
          if (typeof callback === "function") {
            args[callbackIndex] = wrapToolHandler(name, callback as AnyFn);
          }
        }
      }
      return bound(...args);
    };
  }
}
