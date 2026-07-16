'use client';

import React from 'react';
import type { ToolUsageRow } from '../types/usage';

interface UsageTopToolsChartProps {
  rows: ToolUsageRow[];
  onSelectTool: (toolName: string) => void;
}

export function UsageTopToolsChart({
  rows,
  onSelectTool,
}: UsageTopToolsChartProps) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-6">
        Nenhum evento na janela. Use o agent-os normalmente — a telemetria começa
        a acumular a partir de agora.
      </p>
    );
  }

  const maxCalls = Math.max(...rows.map((row) => row.calls), 1);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500 mb-3">
        Clique numa tool para ver o que ela faz.
      </p>
      {rows.map((row, index) => {
        const widthPct = Math.max(4, (row.calls / maxCalls) * 100);
        return (
          <button
            key={row.tool_name}
            type="button"
            onClick={() => onSelectTool(row.tool_name)}
            className="group w-full text-left rounded-lg border border-transparent hover:border-cyan-500/30 hover:bg-cyan-500/5 p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="font-mono text-xs truncate">
                <span className="text-zinc-400 mr-2 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {row.tool_name}
              </span>
              <span className="text-[11px] tabular-nums text-zinc-500 shrink-0">
                {row.calls} · {row.pct}%
                {row.avg_ms != null ? ` · ${row.avg_ms}ms` : ''}
                {row.errors > 0 ? (
                  <span className="text-rose-500"> · {row.errors} err</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 group-hover:from-cyan-500 group-hover:to-teal-300 transition-[width] duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
