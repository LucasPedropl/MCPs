'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeft, Search, HelpCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TopbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  '/agent-os': 'Overview',
  '/agent-os/mcp-servers': 'APIs OpenAPI',
  '/agent-os/hub': 'MCP Hub',
  '/agent-os/jobs': 'Orquestração',
  '/agent-os/memory': 'Memória',
  '/agent-os/knowledge/playbooks': 'Playbooks',
  '/agent-os/knowledge/skills': 'Skills',
  '/agent-os/settings': 'Configurações',
  '/agent-os/projects': 'Projetos',
};

function resolveSection(pathname: string | null): string {
  if (!pathname) return 'Agent OS';

  if (pathname.startsWith('/agent-os/mcp-servers/') && pathname !== '/agent-os/mcp-servers') {
    return 'Detalhe da API';
  }

  if (/^\/agent-os\/jobs\/[^/]+$/.test(pathname)) {
    return 'Detalhe do Job';
  }

  const sorted = Object.entries(BREADCRUMB_LABELS).sort(
    (a, b) => b[0].length - a[0].length,
  );

  const match = sorted.find(([path]) =>
    path === '/agent-os' ? pathname === path : pathname.startsWith(path),
  );

  return match?.[1] ?? 'Agent OS';
}

export function Topbar({ onToggleSidebar, isSidebarOpen }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const section = resolveSection(pathname);

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#000000] px-4 flex items-center justify-between transition-colors z-10 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus:outline-none"
          title={isSidebarOpen ? 'Recolher Menu' : 'Expandir Menu'}
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-zinc-900 dark:text-white font-semibold tracking-tight">Agent OS</span>
          <span className="text-zinc-400 dark:text-zinc-600">/</span>
          <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
            {section}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0a0a0a] text-xs text-zinc-500 dark:text-zinc-400">
          <Search className="w-3.5 h-3.5" />
          <span>Buscar</span>
        </button>

        <button className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          title="Alternar Tema"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
