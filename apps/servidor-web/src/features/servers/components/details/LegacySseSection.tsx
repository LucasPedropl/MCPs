'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Copy } from 'lucide-react';

interface LegacySseSectionProps {
  connectionUrl: string;
  serverId: string;
}

export function LegacySseSection({ connectionUrl, serverId }: LegacySseSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!connectionUrl) return;
    navigator.clipboard.writeText(connectionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
      >
        <span>Legado — SSE Gateway</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-3 text-xs font-mono border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-1.5 pt-3">
            <span className="text-zinc-400 font-sans font-medium">URL SSE (legado)</span>
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800">
              <span className="truncate">{connectionUrl || 'Carregando URL...'}</span>
              <button type="button" onClick={handleCopy} disabled={!connectionUrl}>
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-zinc-400 font-sans font-medium">server_id</span>
            <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800 truncate">
              {serverId}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 font-sans">
            Prefira expor via Agent OS com{' '}
            <code className="font-mono">register_mcp_servers</code> e{' '}
            <code className="font-mono">call_mcp_tool</code>.
          </p>
        </div>
      )}
    </div>
  );
}
