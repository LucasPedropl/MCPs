'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Cpu, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface JobDetail {
  id: string;
  status: string;
  provider: string;
  workspace: string;
  prompt: string;
  error: string | null;
  response: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface JobEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const CANCELLABLE = new Set(['pending', 'running', 'awaiting_approval']);
const RETRYABLE = new Set(['failed', 'cancelled']);

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    if (!jobId) return;
    setLoading(true);
    void fetch(`/api/agent-os/jobs/${jobId}`)
      .then((r) => r.json())
      .then((data: { job?: JobDetail; events?: JobEvent[]; error?: string }) => {
        if (data.error) setError(data.error);
        setJob(data.job ?? null);
        setEvents(data.events ?? []);
      })
      .catch((err: unknown) => {
        console.error('Falha ao carregar job:', err);
        setError('Falha ao carregar job');
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (action: 'cancel' | 'retry') => {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/agent-os/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha na ação');
      return;
    }
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <Link href="/agent-os/jobs" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar aos jobs
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6" /> Job {jobId?.slice(0, 8)}
          </h1>
          {job && (
            <div className="flex gap-2">
              {CANCELLABLE.has(job.status) && (
                <Button variant="danger" size="sm" isLoading={actionLoading} onClick={() => handleAction('cancel')}>
                  <XCircle className="w-4 h-4" /> Cancelar
                </Button>
              )}
              {RETRYABLE.has(job.status) && (
                <Button size="sm" isLoading={actionLoading} onClick={() => handleAction('retry')}>
                  <RotateCcw className="w-4 h-4" /> Reexecutar
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : !job ? (
        <p className="text-sm text-zinc-500">Job não encontrado.</p>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2 text-sm">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900">{job.status}</span>
              <span className="text-zinc-500">{job.provider}</span>
              <span className="text-zinc-400 font-mono truncate">{job.workspace}</span>
            </div>
            <p className="text-xs text-zinc-500">
              Criado {new Date(job.created_at).toLocaleString('pt-BR')}
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <h2 className="text-sm font-medium mb-2">Prompt</h2>
            <pre className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{job.prompt}</pre>
          </section>

          {job.error && (
            <section className="rounded-xl border border-red-200 dark:border-red-900 p-4">
              <h2 className="text-sm font-medium text-red-500 mb-2">Erro</h2>
              <pre className="text-xs whitespace-pre-wrap text-red-400">{job.error}</pre>
            </section>
          )}

          {job.response && (
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <h2 className="text-sm font-medium mb-2">Resposta</h2>
              <pre className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{job.response}</pre>
            </section>
          )}

          {events.length > 0 && (
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
              <h2 className="text-sm font-medium">Eventos ({events.length})</h2>
              {events.map((ev) => (
                <div key={ev.id} className="text-xs border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="font-mono text-zinc-500">{ev.event_type}</span>
                  <span className="text-zinc-400 ml-2">{new Date(ev.created_at).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
