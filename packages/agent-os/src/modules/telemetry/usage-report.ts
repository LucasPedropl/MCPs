import { fetchToolEvents } from "./event-store.js";
import type {
  HostUsageRow,
  ProxyUsageRow,
  ToolEventRow,
  ToolUsageRow,
  UsageReport,
} from "./types.js";

export interface AggregateOptions {
  days: number;
  sinceIso: string;
  untilIso: string;
  registeredTools: string[];
  hiddenTools?: string[];
  limit?: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Agrega eventos em relatório (puro — usável pelo MCP e pelo servidor-web). */
export function aggregateToolEvents(
  events: ToolEventRow[],
  options: AggregateOptions,
): UsageReport {
  const limit = options.limit ?? 20;
  const hidden = new Set(options.hiddenTools ?? []);
  const catalog = options.registeredTools.filter((name) => !hidden.has(name));
  const catalogSet = new Set(catalog);

  const byTool = new Map<
    string,
    { calls: number; errors: number; durationSum: number; durationCount: number }
  >();
  const byHost = new Map<string, { calls: number; errors: number }>();
  const byProxy = new Map<
    string,
    { tool_name: string; alias: string | null; child_tool: string | null; calls: number; errors: number }
  >();
  const touched = new Set<string>();

  for (const event of events) {
    touched.add(event.tool_name);

    const toolStats = byTool.get(event.tool_name) ?? {
      calls: 0,
      errors: 0,
      durationSum: 0,
      durationCount: 0,
    };
    toolStats.calls += 1;
    if (!event.ok) {
      toolStats.errors += 1;
    }
    if (typeof event.duration_ms === "number") {
      toolStats.durationSum += event.duration_ms;
      toolStats.durationCount += 1;
    }
    byTool.set(event.tool_name, toolStats);

    const hostStats = byHost.get(event.host) ?? { calls: 0, errors: 0 };
    hostStats.calls += 1;
    if (!event.ok) {
      hostStats.errors += 1;
    }
    byHost.set(event.host, hostStats);

    if (
      event.tool_name === "call_mcp_tool" ||
      event.tool_name === "call_supabase_tool"
    ) {
      const alias = event.meta.alias ?? null;
      const child = event.meta.child_tool ?? null;
      const key = `${event.tool_name}|${alias ?? ""}|${child ?? ""}`;
      const proxyStats = byProxy.get(key) ?? {
        tool_name: event.tool_name,
        alias,
        child_tool: child,
        calls: 0,
        errors: 0,
      };
      proxyStats.calls += 1;
      if (!event.ok) {
        proxyStats.errors += 1;
      }
      byProxy.set(key, proxyStats);
    }
  }

  const totalCalls = events.length;
  const totalErrors = events.filter((event) => !event.ok).length;

  const top_tools: ToolUsageRow[] = [...byTool.entries()]
    .map(([tool_name, stats]) => ({
      tool_name,
      calls: stats.calls,
      errors: stats.errors,
      avg_ms:
        stats.durationCount > 0
          ? Math.round(stats.durationSum / stats.durationCount)
          : null,
      pct: totalCalls > 0 ? round1((stats.calls / totalCalls) * 100) : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, limit);

  const by_host: HostUsageRow[] = [...byHost.entries()]
    .map(([host, stats]) => ({
      host,
      calls: stats.calls,
      errors: stats.errors,
      pct: totalCalls > 0 ? round1((stats.calls / totalCalls) * 100) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);

  const proxies: ProxyUsageRow[] = [...byProxy.values()]
    .sort((a, b) => b.calls - a.calls)
    .slice(0, limit);

  const never_used = catalog
    .filter((name) => !touched.has(name))
    .sort((a, b) => a.localeCompare(b));

  const touchedInCatalog = catalog.filter((name) => touched.has(name)).length;

  return {
    window: {
      since: options.sinceIso,
      until: options.untilIso,
      days: options.days,
    },
    summary: {
      total_calls: totalCalls,
      error_rate: totalCalls > 0 ? round1((totalErrors / totalCalls) * 100) : 0,
      coverage:
        catalogSet.size > 0
          ? round1((touchedInCatalog / catalogSet.size) * 100)
          : 0,
      registered_tools: catalogSet.size,
      touched_tools: touchedInCatalog,
      by_host,
    },
    top_tools,
    never_used,
    proxies,
  };
}

export async function buildUsageReport(params: {
  days?: number;
  host?: string;
  limit?: number;
  registeredTools: string[];
  hiddenTools?: string[];
}): Promise<UsageReport> {
  const days = Math.max(1, Math.min(params.days ?? 30, 365));
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();

  const events = await fetchToolEvents({
    sinceIso,
    host: params.host,
  });

  return aggregateToolEvents(events, {
    days,
    sinceIso,
    untilIso,
    registeredTools: params.registeredTools,
    hiddenTools: params.hiddenTools,
    limit: params.limit,
  });
}
