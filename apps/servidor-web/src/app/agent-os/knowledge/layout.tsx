'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Visão geral', href: '/agent-os/knowledge' },
  { label: 'Skills', href: '/agent-os/knowledge/skills' },
  { label: 'Playbooks', href: '/agent-os/knowledge/playbooks' },
];

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              pathname === tab.href
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
