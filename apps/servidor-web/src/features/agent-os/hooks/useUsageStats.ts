'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchUsageStats } from '../services/usageService';
import type { UsageDays, UsageHostFilter, UsagePayload } from '../types/usage';

export function useUsageStats() {
  const [days, setDays] = useState<UsageDays>(30);
  const [host, setHost] = useState<UsageHostFilter>('');
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    void fetchUsageStats({ days, host })
      .then(setData)
      .catch((err: unknown) => {
        console.error('Falha ao carregar usage:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, [days, host]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    days,
    setDays,
    host,
    setHost,
    data,
    error,
    isLoading,
    reload: load,
  };
}
