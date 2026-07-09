'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface WorkerStatusData {
  configured: boolean;
  envEnabled: boolean;
  pendingJobsCount: number;
  envVars: {
    AGENT_OS_REALTIME_WORKER: boolean;
    BRIDGE_REALTIME_WORKER: boolean;
  };
  hint: string;
}

export function SettingsWorkerPanel() {
  const [status, setStatus] = useState<WorkerStatusData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void fetch('/api/agent-os/worker-status')
      .then((r) => r.json())
      .then((json: WorkerStatusData) => setStatus(json))
      .catch((err: unknown) => console.error('Falha ao carregar worker status:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" /> Realtime Worker
        </h2>
        <Button size="sm" variant="ghost" onClick={load} isLoading={loading}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="text-xs space-y-1 font-mono">
        <p>Supabase: {status?.configured ? 'conectado' : 'não configurado'}</p>
        <p>
          Worker env:{' '}
          <span className={status?.envEnabled ? 'text-emerald-500' : 'text-zinc-400'}>
            {status?.envEnabled ? 'habilitado' : 'desabilitado'}
          </span>
        </p>
        <p>Jobs pending: {status?.pendingJobsCount ?? '—'}</p>
        <p>
          AGENT_OS_REALTIME_WORKER: {status?.envVars.AGENT_OS_REALTIME_WORKER ? 'definido' : 'ausente'}
        </p>
        <p>
          BRIDGE_REALTIME_WORKER: {status?.envVars.BRIDGE_REALTIME_WORKER ? 'definido' : 'ausente'}
        </p>
      </div>

      {status?.hint && <p className="text-xs text-zinc-500">{status.hint}</p>}
    </section>
  );
}
