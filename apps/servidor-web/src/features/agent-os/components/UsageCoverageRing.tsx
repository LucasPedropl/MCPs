'use client';

import React from 'react';

interface UsageCoverageRingProps {
  coverage: number;
  touched: number;
  registered: number;
}

export function UsageCoverageRing({
  coverage,
  touched,
  registered,
}: UsageCoverageRingProps) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(coverage, 100));
  const filled = (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-elevated)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-700"
        />
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          fill="var(--text-primary)"
          style={{ fontSize: 16, fontWeight: 600 }}
        >
          {clamped}%
        </text>
      </svg>
      <div>
        <div className="text-xs text-ink-muted">Coverage do catálogo</div>
        <div className="text-sm font-medium tabular-nums mt-0.5 text-ink">
          {touched}/{registered} tools tocadas
        </div>
      </div>
    </div>
  );
}
