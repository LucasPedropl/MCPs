'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { PolicyRow } from '@/app/api/agent-os/policies/route';

export function SettingsPolicies() {
  const { addToast } = useToast();
  const [items, setItems] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void fetch('/api/agent-os/policies')
      .then((r) => r.json())
      .then((json: { items?: PolicyRow[] }) => setItems(json.items ?? []))
      .catch((err: unknown) => console.error('Falha ao carregar policies:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/agent-os/policies?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(data.error ?? 'Falha ao remover policy', 'error');
        return;
      }
      addToast('Policy removida', 'success');
      load();
    } catch (err: unknown) {
      console.error('Falha ao deletar policy:', err);
      addToast('Falha ao remover policy', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
      <h2 className="text-sm font-medium flex items-center gap-2">
        <Shield className="w-4 h-4" /> Policies
      </h2>
      <p className="text-xs text-zinc-500">
        Regras avaliadas antes de <code className="font-mono">delegate_async</code>. Gerencie via MCP
        tools <code className="font-mono">upsert_policy</code> / <code className="font-mono">list_policies</code>.
      </p>

      {loading ? (
        <p className="text-xs text-zinc-400">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-zinc-400">Nenhuma policy cadastrada.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((policy) => (
            <li
              key={policy.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 text-xs"
            >
              <div className="space-y-1 min-w-0">
                <p className="font-mono truncate">
                  intent: {policy.intent} · action: {policy.action_pattern}
                </p>
                <p className="text-zinc-500">
                  effect: {policy.rule.effect}
                  {policy.rule.reason ? ` — ${policy.rule.reason}` : ''}
                </p>
                <p className="text-zinc-400">
                  {policy.enabled ? 'habilitada' : 'desabilitada'} · {policy.id.slice(0, 8)}…
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(policy.id)}
                isLoading={deletingId === policy.id}
                aria-label="Remover policy"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
