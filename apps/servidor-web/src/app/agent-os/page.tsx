'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  Cpu,
  GitBranch,
  Sparkles,
  Server,
  ListTodo,
  ArrowRight,
  Database,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';

interface AgentOsStats {
  configured: boolean;
  preferences: number;
  skills: number;
  hubConnections: number;
  jobs: number;
  mcpServers: number;
  decisions: number;
  pitfalls: number;
  pendingJobs: number;
  runningJobs: number;
  recentJobs: Array<{
    id: string;
    status: string;
    provider: string | null;
    workspace: string | null;
    created_at: string;
    prompt: string | null;
  }>;
  hub: Array<{
    alias: string;
    transport: string;
    status: string;
    last_health_at: string | null;
  }>;
}

const MCP_SNIPPET = `{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPs/packages/agent-os/dist/index.js"],
      "env": {
        "AGENT_OS_SUPABASE_URL": "https://xrjjzyfevbuuxeundgds.supabase.co",
        "AGENT_OS_SUPABASE_KEY": "<sua_key>",
        "AGENT_OS_DEFAULT_CWD": "\${workspaceFolder}",
        "AGENT_OS_HOST": "cursor"
      }
    }
  }
}`;

type LoadState = 'loading' | 'ready' | 'error';

export default function AgentOsDashboardPage() {
  const [stats, setStats] = useState<AgentOsStats | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    void fetch('/api/agent-os/stats')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<AgentOsStats>;
      })
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        console.error('Falha ao carregar stats do Agent OS:', error);
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : 'Falha ao carregar',
        );
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const secondaryCards = [
    { label: 'Preferências', value: stats?.preferences, icon: Brain, href: '/agent-os/memory' },
    { label: 'Skills', value: stats?.skills, icon: Sparkles, href: '/agent-os/knowledge/skills' },
    { label: 'Decisões', value: stats?.decisions, icon: Database, href: '/agent-os/memory' },
    { label: 'Pitfalls', value: stats?.pitfalls, icon: Cpu, href: '/agent-os/memory' },
    { label: 'Hub MCP', value: stats?.hubConnections, icon: GitBranch, href: '/agent-os/hub' },
    { label: 'APIs OpenAPI', value: stats?.mcpServers, icon: Server, href: '/agent-os/mcp-servers' },
  ];

  const shortcuts = [
    { title: 'Uso de tools', desc: 'Top tools, nunca usadas e hosts', href: '/agent-os/usage', icon: Activity },
    { title: 'APIs OpenAPI', desc: 'Cadastrar e sincronizar Swagger', href: '/agent-os/mcp-servers', icon: Server },
    { title: 'Hub MCP', desc: 'GitHub, Vercel, presets', href: '/agent-os/hub', icon: GitBranch },
    { title: 'Jobs', desc: 'Delegações e pipelines', href: '/agent-os/jobs', icon: ListTodo },
  ];

  const primaryMetric = stats?.jobs ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Visão geral"
        description="Memória, skills, hub de MCPs, APIs OpenAPI e orquestração multi-IDE."
      />

      {loadState === 'error' && (
        <div
          className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger flex items-start gap-3"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Não foi possível carregar o painel</p>
            <p className="text-xs mt-1 opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {stats && !stats.configured && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e
          SUPABASE_SERVICE_ROLE_KEY em{' '}
          <code className="font-mono text-xs">apps/servidor-web/.env.local</code>.
        </div>
      )}

      {/* Status strip — primary metric */}
      <section className="rounded-lg border border-subtle bg-panel p-5 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted font-medium">
              Jobs no sistema
            </p>
            {loadState === 'loading' ? (
              <Skeleton className="h-10 w-24 mt-2" />
            ) : (
              <p className="text-4xl font-semibold tracking-tight tabular-nums text-ink mt-1 font-mono">
                {primaryMetric ?? '—'}
              </p>
            )}
            <p className="text-xs text-ink-muted mt-2">
              Total registrado · pendentes e em execução abaixo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {loadState === 'loading' ? (
              <>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </>
            ) : (
              <>
                {(stats?.pendingJobs ?? 0) > 0 && (
                  <Link href="/agent-os/jobs?status=pending">
                    <Badge variant="warning">{stats?.pendingJobs} pendentes</Badge>
                  </Link>
                )}
                {(stats?.runningJobs ?? 0) > 0 && (
                  <Link href="/agent-os/jobs?status=running">
                    <Badge variant="accent">{stats?.runningJobs} em execução</Badge>
                  </Link>
                )}
                {(stats?.pendingJobs ?? 0) === 0 &&
                  (stats?.runningJobs ?? 0) === 0 &&
                  loadState === 'ready' && (
                    <Badge variant="default">Fila ociosa</Badge>
                  )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {secondaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border border-subtle bg-panel p-3.5 hover:border-strong transition-colors min-h-[88px]"
          >
            <div className="flex items-center gap-1.5 text-ink-muted text-xs mb-2">
              <card.icon className="w-3.5 h-3.5" aria-hidden />
              {card.label}
            </div>
            {loadState === 'loading' ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-xl font-semibold tabular-nums font-mono text-ink">
                {card.value ?? '—'}
              </div>
            )}
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-subtle bg-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-subtle">
          <h2 className="text-sm font-medium text-ink">Atalhos</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {shortcuts.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-elevated/60 transition-colors group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-elevated text-ink-muted group-hover:text-accent">
                  <link.icon className="w-4 h-4" aria-hidden />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink">
                    {link.title}
                  </span>
                  <span className="block text-xs text-ink-muted truncate">
                    {link.desc}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {loadState === 'ready' && stats?.hub && stats.hub.length === 0 && (
        <EmptyState
          icon={GitBranch}
          title="Nenhuma conexão no Hub"
          description="Conecte presets (GitHub, Vercel) ou APIs OpenAPI em Hub MCP."
          action={
            <Link
              href="/agent-os/hub"
              className="text-sm text-accent hover:underline"
            >
              Abrir Hub MCP
            </Link>
          }
        />
      )}

      {stats?.hub && stats.hub.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2 text-ink">
            <GitBranch className="w-4 h-4" aria-hidden /> Conexões no Hub
          </h2>
          <div className="space-y-2">
            {stats.hub.slice(0, 8).map((row) => (
              <div
                key={row.alias}
                className="flex items-center justify-between text-xs border-b border-subtle pb-2 last:border-0"
              >
                <span className="font-mono text-ink">{row.alias}</span>
                <span className="text-ink-muted">{row.transport}</span>
                <Badge
                  variant={row.status === 'connected' ? 'success' : 'default'}
                >
                  {row.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stats?.recentJobs && stats.recentJobs.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2 text-ink">
            <ListTodo className="w-4 h-4" aria-hidden /> Jobs recentes
          </h2>
          <div className="space-y-2">
            {stats.recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/agent-os/jobs/${job.id}`}
                className="block text-xs border-b border-subtle pb-2 last:border-0 hover:bg-elevated/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-ink-muted">
                    {job.id.slice(0, 8)}
                  </span>
                  <Badge variant="default">{job.status}</Badge>
                  <span className="text-ink-muted">{job.provider ?? '—'}</span>
                </div>
                <p className="text-ink-muted truncate mt-1">
                  {job.prompt ?? '—'}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Database className="w-4 h-4" aria-hidden />
          MCP único no Cursor
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Use <code className="font-mono text-ink">install_mcp_server</code> ou{' '}
          <code className="font-mono text-ink">register_mcp_servers</code> no
          agent-os. Defina{' '}
          <code className="font-mono text-ink">AGENT_OS_HOST</code> por IDE para
          telemetria.
        </p>
        <pre className="text-xs overflow-x-auto rounded-md bg-elevated p-4 border border-subtle font-mono text-ink">
          {MCP_SNIPPET}
        </pre>
      </Card>
    </div>
  );
}
