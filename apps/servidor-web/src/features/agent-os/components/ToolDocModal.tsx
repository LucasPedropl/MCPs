'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ToolDocEntry } from '../types/usage';

interface ToolDocModalProps {
  toolName: string | null;
  doc: ToolDocEntry | null;
  stats?: {
    calls?: number;
    errors?: number;
    avg_ms?: number | null;
    pct?: number;
  };
  onClose: () => void;
}

function parseDocSections(full: string): Array<{ title: string; body: string }> {
  const labels = [
    'WHEN TO USE',
    'WHEN NOT',
    'RETURNS',
    'PARAMS',
    'NOTES',
  ] as const;

  const sections: Array<{ title: string; body: string }> = [];
  let remaining = full.trim();
  const firstLabelIdx = labels
    .map((label) => remaining.indexOf(`${label}:`))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];

  if (firstLabelIdx === undefined || firstLabelIdx < 0) {
    return [{ title: 'Descrição', body: remaining }];
  }

  const summary = remaining.slice(0, firstLabelIdx).trim();
  if (summary) {
    sections.push({ title: 'Resumo', body: summary });
  }
  remaining = remaining.slice(firstLabelIdx);

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const marker = `${label}:`;
    if (!remaining.startsWith(marker)) {
      continue;
    }
    remaining = remaining.slice(marker.length).trimStart();
    const nextIdx = labels
      .slice(i + 1)
      .map((next) => remaining.indexOf(`${next}:`))
      .filter((idx) => idx >= 0)
      .sort((a, b) => a - b)[0];

    const body =
      nextIdx === undefined
        ? remaining.trim()
        : remaining.slice(0, nextIdx).trim();
    if (body) {
      sections.push({ title: label, body });
    }
    remaining =
      nextIdx === undefined ? '' : remaining.slice(nextIdx).trimStart();
  }

  return sections.length > 0 ? sections : [{ title: 'Descrição', body: full }];
}

const SECTION_LABELS: Record<string, string> = {
  Resumo: 'Resumo',
  Descrição: 'Descrição',
  'WHEN TO USE': 'Quando usar',
  'WHEN NOT': 'Quando não usar',
  RETURNS: 'Retorno',
  PARAMS: 'Parâmetros',
  NOTES: 'Notas',
};

export function ToolDocModal({
  toolName,
  doc,
  stats,
  onClose,
}: ToolDocModalProps) {
  useEffect(() => {
    if (!toolName) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolName, onClose]);

  if (!toolName) return null;

  const sections = doc
    ? parseDocSections(doc.full)
    : [{ title: 'Descrição', body: 'Sem documentação cadastrada para esta tool.' }];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tool-doc-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-400 mb-1">
              Tool
            </p>
            <h3
              id="tool-doc-title"
              className="font-mono text-lg font-semibold tracking-tight truncate"
            >
              {toolName}
            </h3>
            {doc?.summary && (
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed line-clamp-3">
                {doc.summary.split('\n')[0]}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(stats?.calls !== undefined ||
          stats?.errors !== undefined ||
          stats?.avg_ms !== undefined) && (
          <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/80 dark:bg-zinc-900/40">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                Calls
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {stats.calls ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                Erros
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {stats.errors ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                Avg ms
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {stats.avg_ms ?? '—'}
              </div>
            </div>
          </div>
        )}

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-1.5">
                {SECTION_LABELS[section.title] ?? section.title}
              </h4>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
