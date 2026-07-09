'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Pencil, Trash2, X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

type Tab = 'preferences' | 'decisions' | 'pitfalls';

interface Preference {
  id: string;
  key: string;
  value_json: { value?: string } | unknown;
  scope: string;
  priority: number;
}

interface Decision {
  id: string;
  topic: string;
  chosen_option: string;
  project: string | null;
  created_at: string;
}

interface Pitfall {
  id: string;
  symptom: string;
  fix: string;
  project: string | null;
  created_at: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'preferences', label: 'Preferências' },
  { id: 'decisions', label: 'Decisões' },
  { id: 'pitfalls', label: 'Pitfalls' },
];

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'project', label: 'Projeto' },
];

const inputClass =
  'px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm';

function prefValue(item: Preference): string {
  const v = item.value_json;
  if (v && typeof v === 'object' && 'value' in v) return String((v as { value: unknown }).value ?? '');
  return JSON.stringify(v);
}

export default function MemoryPage() {
  const [tab, setTab] = useState<Tab>('preferences');
  const [items, setItems] = useState<Array<Preference | Decision | Pitfall>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const endpoint = `/api/agent-os/${tab}`;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetch(endpoint)
      .then((r) => r.json())
      .then((data: { items?: Array<Preference | Decision | Pitfall>; error?: string }) => {
        if (data.error) setError(data.error);
        setItems(data.items ?? []);
      })
      .catch((err: unknown) => {
        console.error('Falha ao carregar memória:', err);
        setError('Falha ao carregar dados');
      })
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    setEditingId(null);
    setForm({});
    load();
  }, [load, tab]);

  const resetForm = () => {
    setForm({});
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao excluir');
      return;
    }
    load();
  };

  const startEdit = (item: Preference | Decision | Pitfall) => {
    setEditingId(item.id);
    if (tab === 'preferences') {
      const p = item as Preference;
      setForm({ key: p.key, value: prefValue(p), scope: p.scope });
    } else if (tab === 'decisions') {
      const d = item as Decision;
      setForm({ topic: d.topic, chosen_option: d.chosen_option, project: d.project ?? '' });
    } else {
      const p = item as Pitfall;
      setForm({ symptom: p.symptom, fix: p.fix, project: p.project ?? '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (editingId && (tab === 'preferences' || tab === 'decisions')) {
      let body: Record<string, unknown> = { id: editingId };
      if (tab === 'preferences') {
        body = { ...body, key: form.key, value_json: { value: form.value }, scope: form.scope || 'global' };
      } else {
        body = { ...body, topic: form.topic, chosen_option: form.chosen_option, project: form.project || null };
      }
      const res = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Falha ao atualizar');
        return;
      }
      resetForm();
      load();
      return;
    }

    let body: Record<string, unknown> = {};
    if (tab === 'preferences') {
      body = { key: form.key, value_json: { value: form.value }, scope: form.scope || 'global' };
    } else if (tab === 'decisions') {
      body = { topic: form.topic, chosen_option: form.chosen_option, project: form.project || null };
    } else {
      body = { symptom: form.symptom, fix: form.fix, project: form.project || null };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao salvar');
      return;
    }
    resetForm();
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="w-6 h-6" /> Memória
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Preferências, decisões arquiteturais e pitfalls.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        {tab === 'preferences' && (
          <>
            <input placeholder="Chave" value={form.key ?? ''} onChange={(e) => setForm({ ...form, key: e.target.value })} className={inputClass} required />
            <input placeholder="Valor" value={form.value ?? ''} onChange={(e) => setForm({ ...form, value: e.target.value })} className={`${inputClass} flex-1 min-w-[120px]`} required />
            <div className="w-36">
              <SearchableSelect options={SCOPE_OPTIONS} value={form.scope ?? 'global'} onChange={(v) => setForm({ ...form, scope: v })} placeholder="Escopo" />
            </div>
          </>
        )}
        {tab === 'decisions' && (
          <>
            <input placeholder="Tópico" value={form.topic ?? ''} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={inputClass} required />
            <input placeholder="Opção escolhida" value={form.chosen_option ?? ''} onChange={(e) => setForm({ ...form, chosen_option: e.target.value })} className={`${inputClass} flex-1 min-w-[120px]`} required />
            <input placeholder="Projeto (opcional)" value={form.project ?? ''} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputClass} />
          </>
        )}
        {tab === 'pitfalls' && (
          <>
            <input placeholder="Sintoma" value={form.symptom ?? ''} onChange={(e) => setForm({ ...form, symptom: e.target.value })} className={inputClass} required />
            <input placeholder="Correção" value={form.fix ?? ''} onChange={(e) => setForm({ ...form, fix: e.target.value })} className={`${inputClass} flex-1 min-w-[120px]`} required />
            <input placeholder="Projeto (opcional)" value={form.project ?? ''} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputClass} />
          </>
        )}
        <button type="submit" className="px-3 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-medium">
          {editingId ? 'Salvar' : 'Adicionar'}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum registro.</p>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <td className="p-3 font-mono text-xs text-zinc-500">{item.id.slice(0, 8)}</td>
                  <td className="p-3">
                    {tab === 'preferences' && (
                      <span>
                        {(item as Preference).key} = {prefValue(item as Preference)}
                        <span className="text-zinc-400 ml-2">({(item as Preference).scope})</span>
                      </span>
                    )}
                    {tab === 'decisions' && (
                      <span>
                        {(item as Decision).topic}: {(item as Decision).chosen_option}
                        {(item as Decision).project && (
                          <span className="text-zinc-400 ml-2">· {(item as Decision).project}</span>
                        )}
                      </span>
                    )}
                    {tab === 'pitfalls' && (
                      <span>
                        {(item as Pitfall).symptom} → {(item as Pitfall).fix}
                        {(item as Pitfall).project && (
                          <span className="text-zinc-400 ml-2">· {(item as Pitfall).project}</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right flex justify-end gap-2">
                    {(tab === 'preferences' || tab === 'decisions') && (
                      <button onClick={() => startEdit(item)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-400" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
