'use client';

import React, { useState } from 'react';
import { GitBranch, Plus, Plug, RefreshCw, Server } from 'lucide-react';
import { useHubConnections } from '@/features/agent-os/hooks/useHubConnections';
import { AddStdioMcpModal } from '@/features/agent-os/components/AddStdioMcpModal';
import { ConnectOpenApiModal } from '@/features/agent-os/components/ConnectOpenApiModal';
import { ToolsExplorerModal } from '@/features/agent-os/components/ToolsExplorerModal';
import { EditConnectionModal } from '@/features/agent-os/components/EditConnectionModal';
import { HubConnectionCard } from '@/features/agent-os/components/HubConnectionCard';
import type { HubConnection } from '@/features/agent-os/types/hub';

export default function HubPage() {
  const { connections, mcpServers, loading, error, setError, load } = useHubConnections();
  const [stdioOpen, setStdioOpen] = useState(false);
  const [openapiOpen, setOpenapiOpen] = useState(false);
  const [exploreConn, setExploreConn] = useState<HubConnection | null>(null);
  const [editConn, setEditConn] = useState<HubConnection | null>(null);

  const handleRefreshHealth = async (alias: string) => {
    const res = await fetch('/api/agent-os/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_health', alias }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao atualizar health');
      return;
    }
    load();
  };

  const handleDisconnect = async (alias: string) => {
    const res = await fetch(`/api/agent-os/hub?alias=${encodeURIComponent(alias)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao desconectar');
      return;
    }
    load();
  };

  const handleRegisterPresets = async () => {
    setError(null);
    const res = await fetch('/api/agent-os/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register_presets' }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao registrar presets');
      return;
    }
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-accent" aria-hidden /> Hub MCP
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Conexões lazy — GitHub, Vercel, APIs OpenAPI e outros MCPs filhos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStdioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-subtle text-xs font-medium hover:bg-elevated"
          >
            <Plus className="w-3.5 h-3.5" /> MCP stdio
          </button>
          <button
            type="button"
            onClick={() => setOpenapiOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-subtle text-xs font-medium hover:bg-elevated"
          >
            <Server className="w-3.5 h-3.5" /> OpenAPI
          </button>
          <button
            type="button"
            onClick={handleRegisterPresets}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-subtle text-xs font-medium hover:bg-elevated"
          >
            <Plug className="w-3.5 h-3.5" /> Conectar presets
          </button>
          <button
            type="button"
            onClick={load}
            className="p-2 rounded-lg border border-subtle hover:bg-elevated"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading && connections.length === 0 ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-ink-muted">
          Nenhuma conexão. Adicione um MCP stdio, conecte OpenAPI ou use{' '}
          <strong>Conectar presets</strong>.
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <HubConnectionCard
              key={conn.id}
              connection={conn}
              onRefreshHealth={handleRefreshHealth}
              onDisconnect={handleDisconnect}
              onExploreTools={setExploreConn}
              onEditConnection={setEditConn}
            />
          ))}
        </div>
      )}

      <AddStdioMcpModal
        isOpen={stdioOpen}
        onClose={() => setStdioOpen(false)}
        onSuccess={load}
        onError={setError}
      />
      <ConnectOpenApiModal
        isOpen={openapiOpen}
        onClose={() => setOpenapiOpen(false)}
        servers={mcpServers}
        onSuccess={load}
        onError={setError}
      />
      <ToolsExplorerModal connection={exploreConn} onClose={() => setExploreConn(null)} />
      <EditConnectionModal
        isOpen={editConn !== null}
        onClose={() => setEditConn(null)}
        connection={editConn}
        onSuccess={load}
        onError={setError}
      />
    </div>
  );
}
