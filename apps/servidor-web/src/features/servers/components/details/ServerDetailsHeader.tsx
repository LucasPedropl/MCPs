'use client';

import React from 'react';
import { Server, Play, RotateCw, Square, RefreshCw, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { McpServerEntity } from '@/features/servers/schemas/serverSchema';

interface ServerDetailsHeaderProps {
  server: McpServerEntity;
  mockEndpoint: string;
  isSyncing: boolean;
  onSync: () => void;
  onConnect: () => void;
}

export function ServerDetailsHeader({ 
  server, 
  mockEndpoint, 
  isSyncing, 
  onSync, 
  onConnect 
}: ServerDetailsHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm transition-colors">
          <Server className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">
              {server.name}
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Running
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1 transition-colors font-mono">
            <span className="truncate max-w-xs md:max-w-md">{mockEndpoint}</span>
            <span>•</span>
            <span>Refreshed May 18, 2026</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
        <Button variant="primary" size="sm" className="gap-1.5" onClick={onConnect}>
          <Play className="w-3.5 h-3.5 fill-current" /> Connect
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={onSync} isLoading={isSyncing}>
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar API (Restart)
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Square className="w-3.5 h-3.5" /> Stop
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Rebuild
        </Button>
        <Button variant="secondary" size="sm" className="px-2">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
