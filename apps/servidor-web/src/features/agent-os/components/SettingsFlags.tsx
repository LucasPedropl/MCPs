'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { SettingFlag } from '../types/settings';

interface SettingsFlagsProps {
  flags: SettingFlag[];
  onUpdated: () => void;
}

export function SettingsFlags({ flags, onUpdated }: SettingsFlagsProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});

  const getValue = (key: string, fallback: boolean) => localFlags[key] ?? fallback;

  const toggle = (key: string, current: boolean) => {
    setLocalFlags((prev) => ({ ...prev, [key]: !current }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, boolean> = {};
      for (const flag of flags) {
        payload[flag.key] = getValue(flag.key, flag.value);
      }
      const res = await fetch('/api/agent-os/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: payload }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(data.error ?? 'Falha ao salvar flags', 'error');
        return;
      }
      addToast('Flags atualizadas', 'success');
      onUpdated();
    } catch (err: unknown) {
      console.error('Falha ao salvar flags:', err);
      addToast('Falha ao salvar flags', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
      <h2 className="text-sm font-medium">Flags do sistema</h2>
      <ul className="space-y-3">
        {flags.map((flag) => {
          const checked = getValue(flag.key, flag.value);
          return (
            <li key={flag.key} className="flex items-start gap-3 text-xs">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(flag.key, checked)}
                className="mt-0.5"
              />
              <div>
                <p className="font-mono font-medium">{flag.key}</p>
                <p className="text-zinc-500 mt-0.5">{flag.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <Button size="sm" onClick={handleSave} isLoading={saving}>
        Salvar flags
      </Button>
    </section>
  );
}
