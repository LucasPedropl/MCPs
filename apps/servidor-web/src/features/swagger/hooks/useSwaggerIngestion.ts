'use client';

import { useState, useCallback } from 'react';
import { parseSwaggerUrlService } from '../services/swaggerService';
import { ParsedSwagger } from '../schemas/swaggerSchema';
import { useToast } from '@/components/ui/Toast';

export function useSwaggerIngestion() {
  const [parsedData, setParsedData] = useState<ParsedSwagger | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const ingestUrl = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const data = await parseSwaggerUrlService(url);
      setParsedData(data);
      addToast(`Sucesso: ${data.tools.length} ferramentas extraidas de "${data.title}"!`, 'success');
      return data;
    } catch (err: any) {
      const msg = err.message || 'Erro desconhecido ao analisar URL';
      setError(msg);
      addToast(msg, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const reset = useCallback(() => {
    setParsedData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    parsedData,
    isLoading,
    error,
    ingestUrl,
    reset
  };
}
