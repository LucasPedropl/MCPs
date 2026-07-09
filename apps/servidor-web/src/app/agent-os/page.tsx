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
} from 'lucide-react';

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
        "AGENT_OS_DEFAULT_CWD": "\${workspaceFolder}"
      }
    }
  }
}`;

export default function AgentOsDashboardPage() {
  const [stats, setStats] = useState<AgentOsStats | null>(null);

  useEffect(() => {
    void fetch('/api/agent-os/stats')
      .then((response) => response.json())
      .then((data: AgentOsStats) => setStats(data))
      .catch((error: unknown) => {
        console.error('Falha ao carregar stats do Agent OS:', error);
      });
  }, []);

  const cards = [
    { label: 'Preferências', value: stats?.preferences ?? '—', icon: Brain, href: '/agent-os/memory' },
    { label: 'Skills (DB)', value: stats?.skills ?? '—', icon: Sparkles, href: '/agent-os/knowledge/skills' },
    { label: 'Decisões', value: stats?.decisions ?? '—', icon: Database, href: '/agent-os/memory' },
    { label: 'Pitfalls', value: stats?.pitfalls ?? '—', icon: Cpu, href: '/agent-os/memory' },
    { label: 'MCP Hub', value: stats?.hubConnections ?? '—', icon: GitBranch, href: '/agent-os/hub' },
    { label: 'APIs OpenAPI', value: stats?.mcpServers ?? '—', icon: Server, href: '/agent-os/mcp-servers' },
  ];

  const quickLinks = [
    { title: 'Gerar MCP via Swagger', desc: 'Cadastre APIs OpenAPI e exponha via hub', href: '/agent-os/mcp-servers' },
    { title: 'Hub de MCPs', desc: 'GitHub, Vercel, OpenAPI e presets', href: '/agent-os/hub' },
    { title: 'Orquestração', desc: 'Jobs, delegações e pipelines', href: '/agent-os/jobs' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Agent OS</h1>
        <p className="text-sm text-zinc-500">
          Painel unificado — memória, skills, hub de MCPs, APIs OpenAPI e orquestração multi-IDE.
        </p>
      </header>

      {stats && !stats.configured && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
          Supabase não configurado. Crie <code className="font-mono text-xs">apps/servidor-web/.env.local</code> com
          NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
        </div>
      )}

      {(stats?.pendingJobs ?? 0) > 0 || (stats?.runningJobs ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {(stats?.pendingJobs ?? 0) > 0 && (
            <Link href="/agent-os/jobs?status=pending" className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
              {stats?.pendingJobs} pending
            </Link>
          )}
          {(stats?.runningJobs ?? 0) > 0 && (
            <Link href="/agent-os/jobs?status=running" className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
              {stats?.runningJobs} running
            </Link>
          )}
        </div>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
              <card.icon className="w-4 h-4" />
              {card.label}
            </div>
            <div className="text-2xl font-semibold">{card.value}</div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <div className="font-medium text-sm">{link.title}</div>
            <p className="text-xs text-zinc-500 flex-1">{link.desc}</p>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              Abrir <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </section>

      {stats?.hub && stats.hub.length > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Conexões no Hub
          </h2>
          <div className="space-y-2">
            {stats.hub.slice(0, 8).map((row) => (
              <div
                key={row.alias}
                className="flex items-center justify-between text-xs border-b border-zinc-100 dark:border-zinc-800 pb-2"
              >
                <span className="font-mono">{row.alias}</span>
                <span className="text-zinc-500">{row.transport}</span>
                <span
                  className={
                    row.status === 'connected'
                      ? 'text-emerald-500'
                      : 'text-zinc-500'
                  }
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats?.recentJobs && stats.recentJobs.length > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="w-4 h-4" /> Jobs recentes
          </h2>
          <div className="space-y-2">
            {stats.recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/agent-os/jobs/${job.id}`}
                className="block text-xs border-b border-zinc-100 dark:border-zinc-800 pb-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-zinc-500">{job.id.slice(0, 8)}</span>
                  <span>{job.status}</span>
                  <span className="text-zinc-500">{job.provider ?? '—'}</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 truncate mt-1">
                  {job.prompt ?? '—'}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database className="w-4 h-4" />
          MCP único no Cursor
        </div>
        <p className="text-xs text-zinc-500">
          Use <code className="font-mono">install_mcp_server</code> ou{' '}
          <code className="font-mono">register_mcp_servers</code> no agent-os para expor APIs
          OpenAPI sem configurar processos separados no mcp.json.
        </p>
        <pre className="text-xs overflow-x-auto rounded-lg bg-zinc-100 dark:bg-black p-4 border border-zinc-200 dark:border-zinc-800">
          {MCP_SNIPPET}
        </pre>
      </section>
    </div>
  );
}
