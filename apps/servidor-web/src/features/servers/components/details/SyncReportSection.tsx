'use client';

import React, { useState } from 'react';
import { X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SyncReport } from '@/features/servers/hooks/useServerDetails';

interface SyncReportSectionProps {
  report: SyncReport;
  onClose: () => void;
}

export function SyncReportSection({ report, onClose }: SyncReportSectionProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'added' | 'modified' | 'removed'>('summary');

  return (
    <Card className="p-6 border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-[#0a0a0a] animate-in fade-in duration-300 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Relatório de Sincronização (Changelog)</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gerado em {new Date(report.created_at || Date.now()).toLocaleString()}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          <X className="w-4 h-4 mr-1" /> Fechar Relatório
        </Button>
      </div>

      <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 text-xs font-medium overflow-x-auto custom-scrollbar">
        <button onClick={() => setActiveTab('summary')} className={`pb-2 border-b-2 whitespace-nowrap ${activeTab === 'summary' ? 'border-accent text-accent font-bold' : 'border-transparent text-zinc-500'}`}>Sumário</button>
        <button onClick={() => setActiveTab('added')} className={`pb-2 border-b-2 whitespace-nowrap flex items-center gap-1 ${activeTab === 'added' ? 'border-emerald-500 text-emerald-600 font-bold' : 'border-transparent text-zinc-500'}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Adicionados ({report.added_endpoints?.length || 0})
        </button>
        <button onClick={() => setActiveTab('modified')} className={`pb-2 border-b-2 whitespace-nowrap flex items-center gap-1 ${activeTab === 'modified' ? 'border-amber-500 text-amber-600 font-bold' : 'border-transparent text-zinc-500'}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Modificados ({report.modified_endpoints?.length || 0})
        </button>
        <button onClick={() => setActiveTab('removed')} className={`pb-2 border-b-2 whitespace-nowrap flex items-center gap-1 ${activeTab === 'removed' ? 'border-red-500 text-red-600 font-bold' : 'border-transparent text-zinc-500'}`}>
          <span className="w-2 h-2 rounded-full bg-red-500" /> Removidos ({report.removed_endpoints?.length || 0})
        </button>
      </div>

      {activeTab === 'summary' && (
        <pre className="p-4 rounded-xl bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap overflow-x-auto max-h-96 custom-scrollbar">
          {report.report_summary}
        </pre>
      )}

      {activeTab === 'added' && (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {(!report.added_endpoints || report.added_endpoints.length === 0) ? (
            <p className="text-xs text-zinc-500 py-4 text-center">Nenhum endpoint adicionado nesta sincronização.</p>
          ) : (
            report.added_endpoints.map((item: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white font-bold text-[10px]">{item.method}</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{item.path}</span>
                </div>
                <span className="text-zinc-500 truncate max-w-xs">{item.name}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'modified' && (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {(!report.modified_endpoints || report.modified_endpoints.length === 0) ? (
            <p className="text-xs text-zinc-500 py-4 text-center">Nenhum endpoint modificado nesta sincronização.</p>
          ) : (
            report.modified_endpoints.map((item: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col gap-1 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold text-[10px]">{item.method}</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{item.path}</span>
                </div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                  <p><strong>Parâmetros Antigos:</strong> {item.old_params || 'Nenhum'}</p>
                  <p><strong>Parâmetros Novos:</strong> {item.new_params || 'Nenhum'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'removed' && (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {(!report.removed_endpoints || report.removed_endpoints.length === 0) ? (
            <p className="text-xs text-zinc-500 py-4 text-center">Nenhum endpoint removido nesta sincronização.</p>
          ) : (
            report.removed_endpoints.map((item: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold text-[10px]">{item.method}</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-semibold line-through">{item.path}</span>
                </div>
                <span className="text-zinc-500 truncate max-w-xs">{item.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
