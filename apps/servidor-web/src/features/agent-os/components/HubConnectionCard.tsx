'use client';

import React from 'react';
import { Key, RefreshCw, Unplug, Wrench } from 'lucide-react';
import type { HubConnection } from '../types/hub';

interface HubConnectionCardProps {
  connection: HubConnection;
  onRefreshHealth: (alias: string) => void;
  onDisconnect: (alias: string) => void;
  onExploreTools: (connection: HubConnection) => void;
  onEditConnection: (connection: HubConnection) => void;
}

export function HubConnectionCard({
  connection,
  onRefreshHealth,
  onDisconnect,
  onExploreTools,
  onEditConnection,
}: HubConnectionCardProps) {
  const toolCount = connection.tool_cache_json?.length ?? 0;

  return (
    <div className="rounded-lg border border-subtle bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="font-mono font-medium">{connection.alias}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-elevated">{connection.transport}</span>
          <span className={connection.status === 'connected' ? 'text-emerald-500' : 'text-ink-muted'}>
            {connection.status}
          </span>
          <button
            type="button"
            onClick={() => onEditConnection(connection)}
            className="p-1 rounded hover:bg-elevated text-ink-muted"
            title="Autenticar / Editar"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onExploreTools(connection)}
            className="p-1 rounded hover:bg-elevated text-ink-muted"
            title="Explorar tools"
          >
            <Wrench className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRefreshHealth(connection.alias)}
            className="p-1 rounded hover:bg-elevated text-ink-muted"
            title="Atualizar health"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDisconnect(connection.alias)}
            className="p-1 rounded hover:bg-elevated text-red-500"
            title="Desconectar"
          >
            <Unplug className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {connection.transport === 'openapi' && typeof connection.config_json?.server_id === 'string' && (
        <p className="text-xs text-ink-muted font-mono mb-2">server_id: {connection.config_json.server_id}</p>
      )}
      <p className="text-xs text-ink-muted">
        Tools em cache: {toolCount}
        {connection.last_health_at &&
          ` · último health: ${new Date(connection.last_health_at).toLocaleString('pt-BR')}`}
      </p>
    </div>
  );
}
