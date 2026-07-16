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
      <p className="text-xs text-ink-muted py-6">
        Nenhum evento na janela. Use o agent-os normalmente — a telemetria
        começa a acumular a partir de agora.
      </p>
    );
  }

  const maxCalls = Math.max(...rows.map((row) => row.calls), 1);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-muted mb-3">
        Clique numa tool para ver o que ela faz.
      </p>
      {rows.map((row, index) => {
        const widthPct = Math.max(4, (row.calls / maxCalls) * 100);
        return (
          <button
            key={row.tool_name}
            type="button"
            onClick={() => onSelectTool(row.tool_name)}
            className="group w-full text-left rounded-md border border-transparent hover:border-accent/30 hover:bg-accent-muted p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="font-mono text-xs truncate text-ink">
                <span className="text-ink-muted mr-2 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {row.tool_name}
              </span>
              <span className="text-[11px] tabular-nums text-ink-muted shrink-0">
                {row.calls} · {row.pct}%
                {row.avg_ms != null ? ` · ${row.avg_ms}ms` : ''}
                {row.errors > 0 ? (
                  <span className="text-danger"> · {row.errors} err</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
