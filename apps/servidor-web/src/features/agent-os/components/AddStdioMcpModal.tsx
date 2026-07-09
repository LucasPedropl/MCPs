'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { HubModal } from './HubModal';

interface AddStdioMcpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function parseArgs(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseEnv(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('env deve ser um objeto JSON');
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    result[key] = String(value);
  }
  return result;
}

export function AddStdioMcpModal({ isOpen, onClose, onSuccess, onError }: AddStdioMcpModalProps) {
  const [alias, setAlias] = useState('');
  const [command, setCommand] = useState('npx');
  const [argsRaw, setArgsRaw] = useState('-y, @modelcontextprotocol/server-github');
  const [envRaw, setEnvRaw] = useState('{}');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const env = parseEnv(envRaw);
      const res = await fetch('/api/agent-os/hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: alias.trim(),
          transport: 'stdio',
          config_json: { command: command.trim(), args: parseArgs(argsRaw), env },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Falha ao adicionar MCP');
        return;
      }
      setAlias('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'JSON de env inválido';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400';

  return (
    <HubModal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar MCP stdio"
      description="Alias, comando, args separados por vírgula e env como JSON."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-500">Alias</span>
          <input className={inputClass} value={alias} onChange={(e) => setAlias(e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-500">Command</span>
          <input className={inputClass} value={command} onChange={(e) => setCommand(e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-500">Args (vírgula)</span>
          <input className={inputClass} value={argsRaw} onChange={(e) => setArgsRaw(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-500">Env (JSON)</span>
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={envRaw}
            onChange={(e) => setEnvRaw(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={submitting}>
            Adicionar
          </Button>
        </div>
      </form>
    </HubModal>
  );
}
