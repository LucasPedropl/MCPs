'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Sun, Moon, LogOut, X } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useLogout } from '@/features/auth/hooks/useAuth';

interface TopbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isMobileNavOpen?: boolean;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  '/agent-os': 'Visão geral',
  '/agent-os/usage': 'Uso',
  '/agent-os/mcp-servers': 'APIs OpenAPI',
  '/agent-os/hub': 'Hub MCP',
  '/agent-os/jobs': 'Jobs',
  '/agent-os/memory': 'Memória',
  '/agent-os/knowledge/playbooks': 'Playbooks',
  '/agent-os/knowledge/skills': 'Skills',
  '/agent-os/knowledge': 'Conhecimento',
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

  if (/^\/agent-os\/projects\/[^/]+$/.test(pathname)) {
    return pathname.endsWith('/new') ? 'Novo projeto' : 'Detalhe do projeto';
  }

  const sorted = Object.entries(BREADCRUMB_LABELS).sort(
    (a, b) => b[0].length - a[0].length,
  );

  const match = sorted.find(([path]) =>
    path === '/agent-os' ? pathname === path : pathname.startsWith(path),
  );

  return match?.[1] ?? 'Agent OS';
}

export function Topbar({
  onToggleSidebar,
  isSidebarOpen,
  isMobileNavOpen = false,
}: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const section = resolveSection(pathname);
  const { logout, isLoggingOut } = useLogout();

  return (
    <header className="h-14 border-b border-subtle bg-panel px-3 sm:px-4 flex items-center justify-between transition-colors z-10 flex-shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-ink-muted hover:bg-elevated hover:text-ink transition-colors"
          aria-label={
            isMobileNavOpen
              ? 'Fechar menu'
              : isSidebarOpen
                ? 'Recolher menu'
                : 'Expandir menu'
          }
          aria-expanded={isSidebarOpen || isMobileNavOpen}
        >
          {isMobileNavOpen ? (
            <X className="w-5 h-5" aria-hidden />
          ) : (
            <Menu className="w-5 h-5" aria-hidden />
          )}
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-medium min-w-0">
          <span className="text-ink font-semibold tracking-tight shrink-0">Agent OS</span>
          <span className="text-ink-muted/50" aria-hidden>
            /
          </span>
          <span className="text-ink-muted truncate max-w-[160px] sm:max-w-xs">
            {section}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-ink-muted hover:bg-elevated hover:text-ink transition-colors"
          aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4" aria-hidden />
          ) : (
            <Sun className="w-4 h-4" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={() => void logout()}
          disabled={isLoggingOut}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md text-sm text-ink-muted hover:bg-elevated hover:text-ink transition-colors disabled:opacity-50"
          aria-label="Sair"
        >
          <LogOut className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">
            {isLoggingOut ? 'Saindo…' : 'Sair'}
          </span>
        </button>
      </div>
    </header>
  );
}
