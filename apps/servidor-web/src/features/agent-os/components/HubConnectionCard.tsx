'use client';

import React from 'react';
import { RefreshCw, Unplug, Wrench } from 'lucide-react';
import type { HubConnection } from '../types/hub';

interface HubConnectionCardProps {
  connection: HubConnection;
  onRefreshHealth: (alias: string) => void;
  onDisconnect: (alias: string) => void;
  onExploreTools: (connection: HubConnection) => void;
}

export function HubConnectionCard({
  connection,
  onRefreshHealth,
  onDisconnect,
  onExploreTools,
}: HubConnectionCardProps) {
  const toolCount = connection.tool_cache_json?.length ?? 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="font-mono font-medium">{connection.alias}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900">{connection.transport}</span>
          <span className={connection.status === 'connected' ? 'text-emerald-500' : 'text-zinc-500'}>
            {connection.status}
          </span>
          <button
            type="button"
            onClick={() => onExploreTools(connection)}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500"
            title="Explorar tools"
          >
            <Wrench className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRefreshHealth(connection.alias)}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500"
            title="Atualizar health"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDisconnect(connection.alias)}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-red-500"
            title="Desconectar"
          >
            <Unplug className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {connection.transport === 'openapi' && typeof connection.config_json?.server_id === 'string' && (
        <p className="text-xs text-zinc-500 font-mono mb-2">server_id: {connection.config_json.server_id}</p>
      )}
      <p className="text-xs text-zinc-500">
        Tools em cache: {toolCount}
        {connection.last_health_at &&
          ` · último health: ${new Date(connection.last_health_at).toLocaleString('pt-BR')}`}
      </p>
    </div>
  );
}
