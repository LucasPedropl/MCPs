'use client';

import React, { useEffect, useState } from 'react';
import { BarChart2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  fetchTestRunsStatsByServerService,
  TestRunsStats,
} from '@/features/tests/services/testsService';

interface ObservabilityCardProps {
  serverId: string;
}

export function ObservabilityCard({ serverId }: ObservabilityCardProps) {
  const [stats, setStats] = useState<TestRunsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchTestRunsStatsByServerService(serverId);
        if (!cancelled) setStats(data);
      } catch (err) {
        console.error('Erro ao carregar estatísticas de testes:', err);
        if (!cancelled) setStats({ total: 0, success: 0, failed: 0, lastRunAt: null });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-accent" />
          Observabilidade
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-zinc-500">Carregando métricas...</p>
        ) : stats && stats.total > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/40">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                Execuções
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                {stats.total}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sucesso
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.success}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
              <p className="text-[10px] text-red-600 dark:text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Falha
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.failed}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/40">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Última execução
              </p>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-2">
                {stats.lastRunAt
                  ? new Date(stats.lastRunAt).toLocaleString('pt-BR')
                  : '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart2 className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              Nenhuma execução de teste registrada. Rode casos na aba{' '}
              <strong>QA &amp; Testes</strong>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
