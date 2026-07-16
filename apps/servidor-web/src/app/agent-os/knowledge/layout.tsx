'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Visão geral', href: '/agent-os/knowledge' },
  { label: 'Skills', href: '/agent-os/knowledge/skills' },
  { label: 'Playbooks', href: '/agent-os/knowledge/playbooks' },
];

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav
        className="flex gap-1 border-b border-subtle pb-2"
        aria-label="Conhecimento"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-11 inline-flex items-center',
                active
                  ? 'bg-elevated text-ink'
                  : 'text-ink-muted hover:bg-elevated/70 hover:text-ink',
              )}
            >
              {active && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent"
                  aria-hidden
                />
              )}
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
