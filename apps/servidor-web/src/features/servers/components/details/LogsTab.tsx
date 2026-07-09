'use client';

import React, { useEffect, useState } from 'react';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  fetchSyncReportsService,
  SyncReportRecord,
} from '@/features/servers/services/syncReportsService';

interface LogsTabProps {
  serverId: string;
}

export function LogsTab({ serverId }: LogsTabProps) {
  const [reports, setReports] = useState<SyncReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchSyncReportsService(serverId);
        if (!cancelled) setReports(data);
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao carregar logs de sincronização:', err);
          setError(err instanceof Error ? err.message : 'Falha ao carregar logs.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm">
        Carregando histórico de sincronização...
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center text-red-600 dark:text-red-400 text-sm">{error}</Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="p-8 text-center border-zinc-200 dark:border-zinc-800/80">
        <Layers className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
          Nenhum log registrado
        </h4>
        <p className="text-sm text-zinc-500">
          Execute uma sincronização da API para gerar relatórios em{' '}
          <code className="font-mono text-xs">mcp_sync_reports</code>.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {reports.length} relatório{reports.length !== 1 ? 's' : ''} de sincronização
      </p>
      {reports.map((report) => {
        const isOpen = expandedId === report.id;
        const added = report.added_endpoints?.length ?? 0;
        const modified = report.modified_endpoints?.length ?? 0;
        const removed = report.removed_endpoints?.length ?? 0;

        return (
          <Card
            key={report.id}
            className="border-zinc-200 dark:border-zinc-800/80 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : report.id)}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    Sincronização — {new Date(report.created_at).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    +{added} / ~{modified} / -{removed} endpoints
                  </p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-800">
                <pre className="mt-3 p-4 rounded-xl bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap overflow-x-auto max-h-72">
                  {report.report_summary}
                </pre>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
