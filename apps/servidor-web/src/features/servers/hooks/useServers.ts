'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchServersService, createServerService, deleteServerService } from '../services/serversService';
import { McpServerEntity, CreateMcpServerInput } from '../schemas/serverSchema';
import { useToast } from '@/components/ui/Toast';

export function useServers() {
  const [servers, setServers] = useState<McpServerEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchServersService();
      setServers(data);
    } catch (err: any) {
      const msg = err.message || 'Erro ao carregar servidores';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const removeServer = useCallback(async (id: string) => {
    try {
      await deleteServerService(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      addToast('Servidor removido com sucesso.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Erro ao remover servidor', 'error');
    }
  }, [addToast]);

  return {
    servers,
    isLoading,
    error,
    refetch: loadServers,
    removeServer
  };
}

export function useCreateServer() {
  const [isCreating, setIsCreating] = useState(false);
  const { addToast } = useToast();

  const createServer = useCallback(async (input: CreateMcpServerInput) => {
    setIsCreating(true);
    try {
      const newServer = await createServerService(input);
      addToast(`Servidor "${newServer.name}" criado com sucesso!`, 'success');
      return newServer;
    } catch (err: any) {
      const msg = err.message || 'Erro ao criar servidor';
      addToast(msg, 'error');
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [addToast]);

  return {
    createServer,
    isCreating
  };
}
