'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  RefreshCw,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { UsageHostChart } from './UsageHostChart';
import { UsageTopToolsChart } from './UsageTopToolsChart';
import { UsageCoverageRing } from './UsageCoverageRing';
import { ToolDocModal } from './ToolDocModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
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
      <PageHeader
        title="Uso de tools"
        description={
          <>
            Quem chama o quê no agent-os. Clique numa tool para abrir a legenda.
            Hosts dependem de{' '}
            <code className="font-mono text-[11px] text-ink">AGENT_OS_HOST</code>{' '}
            no mcp.json.
            {windowLabel ? (
              <span className="block text-[11px] text-ink-muted mt-2 tabular-nums">
                Janela: {windowLabel}
              </span>
            ) : null}
          </>
        }
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReload}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Atualizar
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div
          className="flex gap-1 rounded-md border border-subtle p-1 bg-panel"
          role="group"
          aria-label="Período"
        >
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDaysChange(option)}
              className={`px-3 py-1.5 text-xs rounded-md min-h-9 transition-colors ${
                days === option
                  ? 'bg-accent text-accent-fg'
                  : 'text-ink-muted hover:bg-elevated'
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
          aria-label="Filtrar por host"
          className="text-xs rounded-md border border-subtle bg-panel text-ink px-3 py-2 min-h-11"
        >
          {HOST_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger flex items-start gap-2"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {data && !data.configured && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Supabase não configurado no servidor-web.
        </div>
      )}

      {data?.configured && data.summary && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-lg border border-subtle bg-panel p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted">
                    {card.label}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-1 tracking-tight font-mono text-ink">
                    {card.value}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    {card.hint}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-subtle bg-panel p-5 flex items-center">
              <UsageCoverageRing
                coverage={data.summary.coverage}
                touched={data.summary.touched_tools}
                registered={data.summary.registered_tools}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-subtle bg-panel p-5">
              <h2 className="text-sm font-medium mb-4 text-ink">Por host</h2>
              <UsageHostChart rows={data.summary.by_host} />
            </div>
            <div className="rounded-lg border border-subtle bg-panel p-5">
              <h2 className="text-sm font-medium mb-1 text-ink flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" aria-hidden />
                Top tools
              </h2>
              <UsageTopToolsChart
                rows={data.top_tools ?? []}
                onSelectTool={setSelectedTool}
              />
            </div>
          </section>

          <section className="rounded-lg border border-subtle bg-panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-ink">
                Never used{' '}
                <span className="text-ink-muted font-normal">
                  ({data.never_used?.length ?? 0})
                </span>
              </h2>
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={neverUsedQuery}
                  onChange={(event) => setNeverUsedQuery(event.target.value)}
                  placeholder="Filtrar tools…"
                  aria-label="Filtrar tools nunca usadas"
                  className="text-xs pl-8 pr-3 py-2 rounded-md border border-subtle bg-transparent w-52 text-ink min-h-11"
                />
              </div>
            </div>
            {(data.never_used?.length ?? 0) === 0 ? (
              <p className="text-xs text-ink-muted">
                Todas as tools documentadas foram tocadas na janela.
              </p>
            ) : filteredNeverUsed.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Nenhuma tool bate com “{neverUsedQuery}”.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredNeverUsed.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedTool(name)}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded-md bg-elevated text-ink-muted hover:bg-accent-muted hover:text-accent hover:ring-1 hover:ring-accent/30 transition-colors min-h-9"
                    title="Ver o que esta tool faz"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </section>

          {(data.proxies?.length ?? 0) > 0 && (
            <section className="rounded-lg border border-subtle bg-panel p-5 space-y-3">
              <h2 className="text-sm font-medium text-ink">
                Proxies (alias / child tool)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-muted border-b border-subtle">
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
                        className="border-b border-subtle/60"
                      >
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => setSelectedTool(row.tool_name)}
                            className="font-mono text-ink hover:text-accent"
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
