'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ListTodo, RefreshCw } from 'lucide-react';

interface DelegationJob {
  id: string;
  status: string;
  provider: string | null;
  workspace: string | null;
  prompt: string | null;
  created_at: string;
  updated_at: string | null;
  error: string | null;
}

const STATUS_FILTERS = ['all', 'pending', 'running', 'completed', 'failed', 'cancelled'] as const;

export default function JobsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted p-6">Carregando jobs...</p>}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageContent() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<DelegationJob[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>(
    (searchParams.get('status') as (typeof STATUS_FILTERS)[number]) || 'all',
  );
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const query = filter === 'all' ? '' : `?status=${filter}`;
    void fetch(`/api/agent-os/jobs${query}`)
      .then((r) => r.json())
      .then((data: { jobs?: DelegationJob[] }) => setJobs(data.jobs ?? []))
      .catch((error: unknown) => {
        console.error('Falha ao carregar jobs:', error);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-accent" aria-hidden /> Jobs
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Delegações Cursor ↔ Antigravity e pipelines.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-subtle hover:bg-elevated self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === status
                ? 'bg-accent text-accent-fg'
                : 'bg-elevated text-ink-muted'
            }`}
          >
            {status === 'all' ? 'Todos' : status}
          </button>
        ))}
      </div>

      {loading && jobs.length === 0 ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-subtle p-8 text-center text-sm text-ink-muted">
          Nenhum job encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/agent-os/jobs/${job.id}`}
              className="block rounded-lg border border-subtle bg-panel p-4 text-sm hover:border-strong transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <span className="font-mono text-ink-muted">{job.id.slice(0, 8)}…</span>
                <span className="px-2 py-0.5 rounded bg-elevated">{job.status}</span>
                <span className="text-ink-muted">{job.provider ?? '—'}</span>
                <span className="text-ink-muted ml-auto">
                  {new Date(job.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-ink line-clamp-2">{job.prompt ?? '—'}</p>
              {job.error && (
                <p className="text-xs text-red-500 mt-2 truncate">{job.error}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
