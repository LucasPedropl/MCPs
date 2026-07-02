'use client';

import { useState, useCallback } from 'react';
import { fetchToolsByServerIdService, insertToolsBatchService, deleteToolService } from '../services/toolsService';
import { McpToolEntity, CreateMcpToolInput } from '../schemas/toolSchema';
import { useToast } from '@/components/ui/Toast';

export function useTools(serverId?: string) {
  const [tools, setTools] = useState<McpToolEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const loadTools = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchToolsByServerIdService(id);
      setTools(data);
      return data;
    } catch (err: any) {
      const msg = err.message || 'Erro ao carregar ferramentas';
      setError(msg);
      addToast(msg, 'error');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const removeTool = useCallback(async (toolId: string) => {
    try {
      await deleteToolService(toolId);
      setTools((prev) => prev.filter((t) => t.id !== toolId));
      addToast('Ferramenta removida.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Erro ao remover ferramenta', 'error');
    }
  }, [addToast]);

  return {
    tools,
    isLoading,
    error,
    loadTools,
    removeTool
  };
}

export function useSaveToolsBatch() {
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  const saveBatch = useCallback(async (tools: CreateMcpToolInput[]) => {
    setIsSaving(true);
    try {
      const saved = await insertToolsBatchService(tools);
      addToast(`${saved.length} ferramentas cadastradas com sucesso!`, 'success');
      return saved;
    } catch (err: any) {
      const msg = err.message || 'Erro ao salvar ferramentas no banco';
      addToast(msg, 'error');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  return {
    saveBatch,
    isSaving
  };
}
