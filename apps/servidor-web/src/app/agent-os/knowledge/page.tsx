'use client';

import Link from 'next/link';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    title: 'Skills',
    description: 'Skills versionadas no banco e sincronizáveis para o host (Cursor/Antigravity).',
    href: '/agent-os/knowledge/skills',
    icon: Sparkles,
  },
  {
    title: 'Playbooks',
    description: 'Guias de fluxo por servidor OpenAPI ou alias customizado.',
    href: '/agent-os/knowledge/playbooks',
    icon: BookOpen,
  },
];

export default function KnowledgeHubPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge</h1>
        <p className="text-sm text-zinc-500 mt-1">Skills e playbooks do Agent OS.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors flex flex-col gap-3"
          >
            <card.icon className="w-6 h-6 text-zinc-500" />
            <div>
              <h2 className="font-semibold">{card.title}</h2>
              <p className="text-sm text-zinc-500 mt-1">{card.description}</p>
            </div>
            <span className="text-xs text-zinc-400 flex items-center gap-1 mt-auto">
              Abrir <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
