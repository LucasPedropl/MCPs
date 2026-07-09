'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { SettingsSupabaseAccounts } from '@/features/agent-os/components/SettingsSupabaseAccounts';
import { SettingsPresetsEditor } from '@/features/agent-os/components/SettingsPresetsEditor';
import { SettingsDangerZone } from '@/features/agent-os/components/SettingsDangerZone';
import { SettingsFlags } from '@/features/agent-os/components/SettingsFlags';
import { SettingsPolicies } from '@/features/agent-os/components/SettingsPolicies';
import { SettingsWorkerPanel } from '@/features/agent-os/components/SettingsWorkerPanel';
import type { SettingsData } from '@/features/agent-os/types/settings';

export default function SettingsPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<SettingsData | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    void fetch('/api/agent-os/settings')
      .then((r) => r.json())
      .then((json: SettingsData) => setData(json))
      .catch((err: unknown) => console.error('Falha ao carregar settings:', err));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSyncSkills = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/agent-os/settings/sync-skills', { method: 'POST' });
      const json = (await res.json()) as {
        note?: string;
        error?: string;
        synced?: number;
      };
      if (!res.ok) {
        addToast(json.error ?? 'Falha ao sincronizar skills', 'error');
        return;
      }
      addToast(
        json.note ??
          (json.synced
            ? `${json.synced} skill(s) sincronizada(s)`
            : 'Sync concluído'),
        'success',
      );
    } catch (err: unknown) {
      console.error('Falha sync skills:', err);
      addToast('Falha ao sincronizar skills', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const toSnippet = (entry: SettingsData['mcpSnippet']) =>
    JSON.stringify({ mcpServers: { 'agent-os': entry } }, null, 2);

  const cursorSnippet = data ? toSnippet(data.mcpSnippet) : '';
  const antigravitySnippet = data
    ? toSnippet(data.antigravitySnippet ?? data.mcpSnippet)
    : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6" /> Configurações
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Status do Supabase, variáveis de ambiente e MCP.</p>
      </header>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Database className="w-4 h-4" /> Supabase (Agent OS DB)
        </h2>
        <div className="text-xs space-y-1 font-mono">
          <p>Configurado: {data?.configured ? 'sim' : 'não'}</p>
          <p>URL: {data?.supabase.url ?? '—'}</p>
          <p>Service role: {data?.supabase.serviceRoleKey ?? '—'}</p>
          <p>Anon key: {data?.supabase.anonKey ?? '—'}</p>
          <p>Conexões no hub: {data?.hubCount ?? '—'}</p>
        </div>
      </section>

      <SettingsSupabaseAccounts />

      {data?.flags && <SettingsFlags flags={data.flags} onUpdated={load} />}

      <SettingsWorkerPanel />

      <SettingsPolicies />
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <h2 className="text-sm font-medium">Variáveis de ambiente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {data &&
            Object.entries(data.env).map(([key, ok]) => (
              <div key={key} className="flex justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-1">
                <span className="font-mono text-zinc-500">{key}</span>
                <span className={ok ? 'text-emerald-500' : 'text-zinc-400'}>{ok ? 'ok' : 'ausente'}</span>
              </div>
            ))}
        </div>
      </section>

      <SettingsPresetsEditor />

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Sync skills
        </h2>
        <p className="text-xs text-zinc-500">
          Importa skills de <code className="font-mono">skills/</code> do monorepo para{' '}
          <code className="font-mono">agent_skills</code> no Supabase.
        </p>
        <Button size="sm" onClick={handleSyncSkills} isLoading={syncing}>
          Sincronizar skills
        </Button>
      </section>

      {data?.configPaths && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-2 text-xs font-mono">
          <h2 className="text-sm font-medium font-sans">Caminhos de config</h2>
          <p>Cursor: {data.configPaths.cursor}</p>
          <p>Antigravity: {data.configPaths.antigravity}</p>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <h2 className="text-sm font-medium">Snippet MCP — Cursor</h2>
        <pre className="text-xs overflow-x-auto rounded-lg bg-zinc-100 dark:bg-black p-4 border border-zinc-200 dark:border-zinc-800">
          {cursorSnippet || 'Carregando...'}
        </pre>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <h2 className="text-sm font-medium">Snippet MCP — Antigravity</h2>
        <p className="text-xs text-zinc-500">
          Manage MCP Servers → View raw config → cole o JSON abaixo em{' '}
          <code className="font-mono">~/.gemini/config/mcp_config.json</code>
        </p>
        <pre className="text-xs overflow-x-auto rounded-lg bg-zinc-100 dark:bg-black p-4 border border-zinc-200 dark:border-zinc-800">
          {antigravitySnippet || 'Carregando...'}
        </pre>
      </section>

      <SettingsDangerZone />
    </div>
  );
}
