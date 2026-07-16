'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { UsageHostChart } from './UsageHostChart';
import { UsageTopToolsChart } from './UsageTopToolsChart';
import { UsageCoverageRing } from './UsageCoverageRing';
import { ToolDocModal } from './ToolDocModal';
import type {
  ToolUsageRow,
  UsageDays,
  UsageHostFilter,
  UsagePayload,
} from '../types/usage';

const DAY_OPTIONS: UsageDays[] = [7, 30, 90];
const HOST_OPTIONS: Array<{ value: UsageHostFilter; label: string }> = [
  { value: '', label: 'Todos os hosts' },
  { value: 'cursor', label: 'cursor' },
  { value: 'antigravity', label: 'antigravity' },
  { value: 'claude_code', label: 'claude_code' },
  { value: 'unknown', label: 'unknown' },
];

interface UsageDashboardProps {
  days: UsageDays;
  host: UsageHostFilter;
  data: UsagePayload | null;
  error: string | null;
  isLoading: boolean;
  onDaysChange: (days: UsageDays) => void;
  onHostChange: (host: UsageHostFilter) => void;
  onReload: () => void;
}

export function UsageDashboard({
  days,
  host,
  data,
  error,
  isLoading,
  onDaysChange,
  onHostChange,
  onReload,
}: UsageDashboardProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [neverUsedQuery, setNeverUsedQuery] = useState('');

  const toolStats = useMemo(() => {
    const map = new Map<string, ToolUsageRow>();
    for (const row of data?.top_tools ?? []) {
      map.set(row.tool_name, row);
    }
    return map;
  }, [data?.top_tools]);

  const filteredNeverUsed = useMemo(() => {
    const list = data?.never_used ?? [];
    const q = neverUsedQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((name) => name.toLowerCase().includes(q));
  }, [data?.never_used, neverUsedQuery]);

  const selectedDoc = selectedTool
    ? data?.tool_docs?.[selectedTool] ?? null
    : null;
  const selectedStats = selectedTool
    ? toolStats.get(selectedTool)
    : undefined;

  const windowLabel =
    data?.window != null
      ? `${new Date(data.window.since).toLocaleDateString('pt-BR')} → ${new Date(data.window.until).toLocaleDateString('pt-BR')}`
      : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="space-y-3">
        <Link
          href="/agent-os"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3 h-3" /> Overview
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-500" /> Tool usage
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Quem chama o quê no agent-os. Clique numa tool para abrir a
              legenda. Hosts dependem de{' '}
              <code className="font-mono text-[11px]">AGENT_OS_HOST</code> no
              mcp.json.
            </p>
            {windowLabel && (
              <p className="text-[11px] text-zinc-400 mt-2 tabular-nums">
                Janela: {windowLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            Atualizar
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-white dark:bg-zinc-950">
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDaysChange(option)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                days === option
                  ? 'bg-cyan-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              {option}d
            </button>
          ))}
        </div>
        <select
          value={host}
          onChange={(event) =>
            onHostChange(event.target.value as UsageHostFilter)
          }
          className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2"
        >
          {HOST_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !data && (
        <p className="text-sm text-zinc-500">Carregando telemetria…</p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {data && !data.configured && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
          Supabase não configurado no servidor-web.
        </div>
      )}

      {data?.configured && data.summary && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: 'Calls',
                  value: data.summary.total_calls.toLocaleString('pt-BR'),
                  hint: 'total na janela',
                },
                {
                  label: 'Error rate',
                  value: `${data.summary.error_rate}%`,
                  hint: 'falhas / calls',
                },
                {
                  label: 'Tools tocadas',
                  value: String(data.summary.touched_tools),
                  hint: `de ${data.summary.registered_tools}`,
                },
                {
                  label: 'Never used',
                  value: String(data.never_used?.length ?? 0),
                  hint: 'no catálogo',
                },
              ].map((card) => (
                <div key={card.label}>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                    {card.label}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1 tracking-tight">
                    {card.value}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {card.hint}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex items-center">
              <UsageCoverageRing
                coverage={data.summary.coverage}
                touched={data.summary.touched_tools}
                registered={data.summary.registered_tools}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
              <h2 className="text-sm font-medium mb-4">Por host</h2>
              <UsageHostChart rows={data.summary.by_host} />
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
              <h2 className="text-sm font-medium mb-1">Top tools</h2>
              <UsageTopToolsChart
                rows={data.top_tools ?? []}
                onSelectTool={setSelectedTool}
              />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium">
                Never used{' '}
                <span className="text-zinc-400 font-normal">
                  ({data.never_used?.length ?? 0})
                </span>
              </h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={neverUsedQuery}
                  onChange={(event) => setNeverUsedQuery(event.target.value)}
                  placeholder="Filtrar tools…"
                  className="text-xs pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent w-52"
                />
              </div>
            </div>
            {(data.never_used?.length ?? 0) === 0 ? (
              <p className="text-xs text-zinc-500">
                Todas as tools documentadas foram tocadas na janela.
              </p>
            ) : filteredNeverUsed.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Nenhuma tool bate com “{neverUsedQuery}”.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredNeverUsed.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedTool(name)}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-700 dark:hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/30 transition-colors"
                    title="Ver o que esta tool faz"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </section>

          {(data.proxies?.length ?? 0) > 0 && (
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
              <h2 className="text-sm font-medium">Proxies (alias / child tool)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                      <th className="py-2 pr-4 font-medium">Proxy</th>
                      <th className="py-2 pr-4 font-medium">Alias</th>
                      <th className="py-2 pr-4 font-medium">Child</th>
                      <th className="py-2 pr-4 font-medium">Calls</th>
                      <th className="py-2 font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.proxies?.map((row) => (
                      <tr
                        key={`${row.tool_name}-${row.alias}-${row.child_tool}`}
                        className="border-b border-zinc-50 dark:border-zinc-900"
                      >
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => setSelectedTool(row.tool_name)}
                            className="font-mono hover:text-cyan-600 dark:hover:text-cyan-400"
                          >
                            {row.tool_name}
                          </button>
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {row.alias ?? '—'}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {row.child_tool ?? '—'}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{row.calls}</td>
                        <td className="py-2 tabular-nums">{row.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <ToolDocModal
        toolName={selectedTool}
        doc={selectedDoc}
        stats={
          selectedStats
            ? {
                calls: selectedStats.calls,
                errors: selectedStats.errors,
                avg_ms: selectedStats.avg_ms,
                pct: selectedStats.pct,
              }
            : undefined
        }
        onClose={() => setSelectedTool(null)}
      />
    </div>
  );
}
