'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useServers } from '@/features/servers/hooks/useServers';

interface Playbook {
  id: string;
  alias: string | null;
  author: string;
  version_tag: string;
  server_id: string | null;
  created_at: string;
}

export default function PlaybooksPage() {
  const [items, setItems] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ alias: '', content_md: '', server_id: '' });
  const { servers } = useServers();

  const serverOptions = useMemo(
    () => [{ value: '', label: 'Nenhum (global)' }, ...servers.map((s) => ({ value: s.id, label: s.name }))],
    [servers],
  );

  const load = () => {
    setLoading(true);
    void fetch('/api/agent-os/playbooks')
      .then((r) => r.json())
      .then((data: { items?: Playbook[]; error?: string }) => {
        if (data.error) setError(data.error);
        setItems(data.items ?? []);
      })
      .catch((err: unknown) => {
        console.error('Falha ao carregar playbooks:', err);
        setError('Falha ao carregar playbooks');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/agent-os/playbooks?id=${id}`, { method: 'DELETE' });
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/agent-os/playbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: form.alias || null,
        content_md: form.content_md,
        server_id: form.server_id || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao criar playbook');
      return;
    }
    setForm({ alias: '', content_md: '', server_id: '' });
    setModalOpen(false);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2">
            <BookOpen className="w-6 h-6" /> Playbooks
          </h1>
          <p className="text-sm text-ink-muted mt-1">Playbooks de APIs e fluxos reutilizáveis.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/agent-os/knowledge/skills" className="text-xs text-ink-muted hover:text-ink">
            ← Skills
          </Link>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" /> Novo playbook
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum playbook cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((pb) => (
            <div key={pb.id} className="rounded-lg border border-subtle p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-sm">{pb.alias ?? `Playbook ${pb.id.slice(0, 8)}`}</div>
                <p className="text-xs text-ink-muted mt-1">
                  {pb.author} · v{pb.version_tag}
                  {pb.server_id && ` · server ${pb.server_id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-ink-muted">{new Date(pb.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => handleDelete(pb.id)} className="text-red-500 shrink-0" title="Excluir">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-lg border border-subtle bg-panel shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo playbook</h2>
              <button onClick={() => setModalOpen(false)} className="text-ink-muted hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Alias</label>
                <input
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                  placeholder="ex: criar-usuario"
                  className="w-full px-3 py-2 rounded-lg border border-subtle bg-panel text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Servidor MCP (opcional)</label>
                <SearchableSelect
                  options={serverOptions}
                  value={form.server_id}
                  onChange={(v) => setForm({ ...form, server_id: v })}
                  placeholder="Selecione um servidor..."
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Conteúdo (Markdown)</label>
                <textarea
                  value={form.content_md}
                  onChange={(e) => setForm({ ...form, content_md: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border border-subtle bg-panel text-sm font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button type="submit" isLoading={saving}>Criar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
