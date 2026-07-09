'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  scope: string;
  content_md: string;
  updated_at: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', content_md: '' });

  const load = () => {
    setLoading(true);
    void fetch('/api/agent-os/skills')
      .then((r) => r.json())
      .then((data: { items?: Skill[]; error?: string }) => {
        if (data.error) setError(data.error);
        setSkills(data.items ?? []);
      })
      .catch((err: unknown) => {
        console.error('Falha ao carregar skills:', err);
        setError('Falha ao carregar skills');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (name: string, version: string) => {
    await fetch(`/api/agent-os/skills?name=${encodeURIComponent(name)}&version=${encodeURIComponent(version)}`, {
      method: 'DELETE',
    });
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/agent-os/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, content_md: form.content_md }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Falha ao criar skill');
      return;
    }
    setForm({ name: '', content_md: '' });
    setModalOpen(false);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6" /> Skills
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Skills persistidas no banco Agent OS.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/agent-os/knowledge/playbooks" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Ver playbooks →
          </Link>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" /> Nova skill
          </Button>
        </div>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma skill cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div key={skill.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-medium">{skill.name}</div>
                  <p className="text-xs text-zinc-500 mt-1">{skill.description || '—'}</p>
                  <p className="text-xs text-zinc-400 mt-1">v{skill.version} · {skill.scope}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {skill.content_md && (
                    <button
                      onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs flex items-center gap-1"
                    >
                      {expandedId === skill.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Preview
                    </button>
                  )}
                  <button onClick={() => handleDelete(skill.name, skill.version)} className="text-red-500" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {expandedId === skill.id && skill.content_md && (
                <pre className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800">
                  {skill.content_md}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova skill</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Conteúdo (Markdown)</label>
                <textarea
                  value={form.content_md}
                  onChange={(e) => setForm({ ...form, content_md: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-mono"
                  required
                />
              </div>
              {form.content_md && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Pré-visualização</p>
                  <pre className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 max-h-40 overflow-y-auto">
                    {form.content_md}
                  </pre>
                </div>
              )}
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
