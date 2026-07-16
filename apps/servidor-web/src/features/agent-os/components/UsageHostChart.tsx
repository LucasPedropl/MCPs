'use client';

import React from 'react';
import type { HostUsageRow } from '../types/usage';

const HOST_COLORS: Record<string, string> = {
  cursor: '#22d3ee',
  antigravity: '#fbbf24',
  claude_code: '#fb7185',
  unknown: '#71717a',
};

interface UsageHostChartProps {
  rows: HostUsageRow[];
}

export function UsageHostChart({ rows }: UsageHostChartProps) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-8 text-center">
        Sem dados de host nesta janela.
      </p>
    );
  }

  const size = 180;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = rows.reduce((sum, row) => sum + row.calls, 0) || 1;

  let offset = 0;
  const arcs = rows.map((row) => {
    const length = (row.calls / total) * circumference;
    const arc = {
      ...row,
      color: HOST_COLORS[row.host] ?? HOST_COLORS.unknown,
      dash: `${length} ${circumference - length}`,
      offset: -offset,
    };
    offset += length;
    return arc;
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        aria-label="Distribuição por host"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-100 dark:text-zinc-900"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.host}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={arc.dash}
            strokeDashoffset={arc.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dasharray] duration-500"
          />
        ))}
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          className="fill-zinc-900 dark:fill-white text-2xl font-semibold"
          style={{ fontSize: 28 }}
        >
          {total}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          className="fill-zinc-500"
          style={{ fontSize: 11 }}
        >
          calls
        </text>
      </svg>

      <ul className="w-full space-y-2.5">
        {arcs.map((arc) => (
          <li key={arc.host} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: arc.color }}
              />
              <span className="font-mono truncate">{arc.host}</span>
            </span>
            <span className="tabular-nums text-zinc-500 shrink-0">
              {arc.calls} · {arc.pct}%
              {arc.errors > 0 ? ` · ${arc.errors} err` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
