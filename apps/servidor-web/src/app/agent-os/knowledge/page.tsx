'use client';

import Link from 'next/link';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

const CARDS = [
  {
    title: 'Skills',
    description:
      'Skills versionadas no banco e sincronizáveis para o host (Cursor/Antigravity).',
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
      <PageHeader
        title="Conhecimento"
        description="Skills e playbooks do Agent OS."
      />

      <ul className="rounded-lg border border-subtle bg-panel divide-y divide-[var(--border-subtle)] overflow-hidden">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="flex items-center gap-3 px-4 py-4 hover:bg-elevated/60 transition-colors group"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-elevated text-ink-muted group-hover:text-accent">
                <card.icon className="w-4 h-4" aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {card.title}
                </span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  {card.description}
                </span>
              </span>
              <ArrowRight
                className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
