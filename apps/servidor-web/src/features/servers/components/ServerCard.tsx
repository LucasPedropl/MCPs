'use client';

import React from 'react';
import { McpServerEntity } from '../schemas/serverSchema';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Server, Trash2, ExternalLink, ShieldCheck, Key } from 'lucide-react';

interface ServerCardProps {
  server: McpServerEntity;
  onDelete: (id: string) => void;
  onSelect?: (server: McpServerEntity) => void;
}

export function ServerCard({ server, onDelete, onSelect }: ServerCardProps) {
  const authLabel = {
    none: 'Sem Autenticacao',
    dashboard_login: 'Login Gerenciado',
    autonomous: 'IA Autonoma'
  }[server.auth_type];

  return (
    <Card className="flex flex-col justify-between border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0a] hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-300 group">
      <div>
        <CardHeader className="flex flex-row items-center justify-between gap-4 mb-2 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-zinc-900 dark:text-white transition-colors">
                {server.name}
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] transition-colors">
                {server.api_base_url}
              </CardDescription>
            </div>
          </div>
          <button
            onClick={() => onDelete(server.id)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Remover Servidor"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-800/60 transition-colors">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Auth: <strong className="text-zinc-900 dark:text-zinc-200">{authLabel}</strong></span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Key className="w-4 h-4 text-zinc-900 dark:text-zinc-400 shrink-0" />
            <span className="truncate">Swagger: <span className="text-zinc-700 dark:text-zinc-300">{server.swagger_url}</span></span>
          </div>
        </CardContent>
      </div>
      <CardFooter className="pt-3 border-t border-zinc-200 dark:border-zinc-800/60 mt-4 flex justify-between items-center transition-colors">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
          ID: {server.id.substring(0, 8)}...
        </span>
        {onSelect && (
          <Button variant="ghost" size="sm" onClick={() => onSelect(server)} className="text-zinc-900 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
            <ExternalLink className="w-4 h-4 mr-1" /> Gerenciar Tools
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
