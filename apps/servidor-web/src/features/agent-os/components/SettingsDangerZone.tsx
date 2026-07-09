'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function SettingsDangerZone() {
  const { addToast } = useToast();
  const [clearingCache, setClearingCache] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);

  const clearToolCache = async () => {
    setClearingCache(true);
    try {
      const res = await fetch('/api/agent-os/settings/danger', { method: 'DELETE' });
      const data = (await res.json()) as { error?: string; note?: string };
      if (!res.ok) {
        addToast(data.error ?? 'Falha ao limpar cache', 'error');
        return;
      }
      addToast(data.note ?? 'Tool cache limpo', 'success');
    } catch (err: unknown) {
      console.error('Falha danger zone:', err);
      addToast('Falha ao limpar cache', 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const resetAll = async () => {
    setResettingAll(true);
    try {
      const res = await fetch('/api/agent-os/settings/danger?resetPreferences=true', {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string; note?: string };
      if (!res.ok) {
        addToast(data.error ?? 'Falha ao resetar', 'error');
        return;
      }
      addToast(data.note ?? 'Reset concluído', 'success');
    } catch (err: unknown) {
      console.error('Falha danger zone:', err);
      addToast('Falha ao resetar', 'error');
    } finally {
      setResettingAll(false);
    }
  };

  return (
    <section className="rounded-xl border border-red-200 dark:border-red-900/50 p-6 space-y-3">
      <h2 className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-4 h-4" /> Zona de perigo
      </h2>
      <p className="text-xs text-zinc-500">
        Limpar tool_cache_json de todas as conexões do hub. Opcionalmente resetar preferências do agente.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" size="sm" onClick={clearToolCache} isLoading={clearingCache}>
          Limpar tool cache
        </Button>
        <Button variant="danger" size="sm" onClick={resetAll} isLoading={resettingAll}>
          Limpar cache + preferências
        </Button>
      </div>
    </section>
  );
}
