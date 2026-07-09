'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function SettingsPresetsEditor() {
  const { addToast } = useToast();
  const [jsonText, setJsonText] = useState('');
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch('/api/agent-os/presets')
      .then((r) => r.json())
      .then((data: { path?: string; presets?: unknown[] }) => {
        setPath(data.path ?? '');
        setJsonText(JSON.stringify({ presets: data.presets ?? [] }, null, 2));
      })
      .catch((err: unknown) => console.error('Falha ao carregar presets:', err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(jsonText) as { presets: unknown[] };
      const res = await fetch('/api/agent-os/presets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { error?: string; note?: string };
      if (!res.ok) {
        addToast(data.error ?? 'Falha ao salvar presets', 'error');
        return;
      }
      addToast('Presets salvos', 'success');
    } catch (err: unknown) {
      console.error('JSON inválido:', err);
      addToast('JSON inválido', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
      <h2 className="text-sm font-medium">Presets MCP (JSON)</h2>
      <p className="text-xs text-zinc-500 font-mono">{path || 'packages/agent-os/presets/mcp-presets.json'}</p>
      <textarea
        className="w-full min-h-[200px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-black p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        spellCheck={false}
      />
      <Button size="sm" onClick={handleSave} isLoading={saving}>
        Salvar presets
      </Button>
    </section>
  );
}
