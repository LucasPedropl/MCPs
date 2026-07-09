'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { HubModal } from './HubModal';
import type { McpServerSummary } from '../types/hub';

interface ConnectOpenApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: McpServerSummary[];
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function ConnectOpenApiModal({
  isOpen,
  onClose,
  servers,
  onSuccess,
  onError,
}: ConnectOpenApiModalProps) {
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnect = async (serverId: string) => {
    setConnectingId(serverId);
    try {
      const res = await fetch('/api/agent-os/hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_openapi', server_id: serverId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Falha ao conectar OpenAPI');
        return;
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Falha ao conectar OpenAPI:', err);
      onError('Falha ao conectar OpenAPI');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <HubModal
      isOpen={isOpen}
      onClose={onClose}
      title="Conectar servidor OpenAPI"
      description="Registra o servidor como conexão openapi no hub."
      maxWidth="xl"
    >
      {servers.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhum servidor cadastrado. Importe Swagger em{' '}
          <span className="font-mono">/agent-os/mcp-servers</span>.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
          {servers.map((server) => (
            <li
              key={server.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{server.name}</p>
                <p className="text-xs text-zinc-500 font-mono truncate">{server.api_base_url}</p>
              </div>
              <Button
                size="sm"
                onClick={() => handleConnect(server.id)}
                isLoading={connectingId === server.id}
              >
                Conectar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </HubModal>
  );
}
