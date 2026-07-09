'use client';

import React, { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';

interface SupabaseAccount {
  id: string;
  label: string;
  email: string | null;
  createdAt: string;
}

interface SupabaseProject {
  id: string;
  accountId: string;
  ref: string;
  name: string;
  url: string;
}

interface AccountsResponse {
  configured: boolean;
  configPath: string;
  accounts: SupabaseAccount[];
  projects: SupabaseProject[];
  activeContext: { accountId: string; projectRef: string; projectName?: string } | null;
  note: string;
}

export function SettingsSupabaseAccounts() {
  const [data, setData] = useState<AccountsResponse | null>(null);

  useEffect(() => {
    void fetch('/api/agent-os/supabase-accounts')
      .then((r) => r.json())
      .then((json: AccountsResponse) => setData(json))
      .catch((err: unknown) => console.error('Falha ao carregar contas Supabase:', err));
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
      <h2 className="text-sm font-medium flex items-center gap-2">
        <Cloud className="w-4 h-4" /> Contas Supabase (hub)
      </h2>
      <p className="text-xs text-zinc-500">{data?.note ?? 'Carregando...'}</p>
      <p className="text-xs font-mono text-zinc-500">Config: {data?.configPath ?? '—'}</p>
      {!data?.configured || data.accounts.length === 0 ? (
        <p className="text-xs text-zinc-500">Nenhuma conta no arquivo local.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {data.accounts.map((account) => (
            <li
              key={account.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex justify-between gap-2"
            >
              <span className="font-medium">{account.label}</span>
              <span className="text-zinc-500 font-mono">{account.email ?? account.id.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
      )}
      {data?.activeContext && (
        <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
          Ativo: {data.activeContext.projectName ?? data.activeContext.projectRef}
        </p>
      )}
      {data && data.projects.length > 0 && (
        <p className="text-xs text-zinc-500">{data.projects.length} projeto(s) sincronizado(s)</p>
      )}
    </section>
  );
}
