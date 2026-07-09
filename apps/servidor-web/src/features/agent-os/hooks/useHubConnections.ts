'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HubConnection, HubResponse, McpServerSummary } from '../types/hub';

export function useHubConnections() {
  const [connections, setConnections] = useState<HubConnection[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent-os/hub');
      const data = (await res.json()) as HubResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Falha ao carregar hub');
        return;
      }
      setConnections(data.connections ?? []);
      setMcpServers(data.mcp_servers ?? []);
    } catch (err: unknown) {
      console.error('Falha ao carregar hub:', err);
      setError('Falha ao carregar conexões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { connections, mcpServers, loading, error, setError, load };
}
