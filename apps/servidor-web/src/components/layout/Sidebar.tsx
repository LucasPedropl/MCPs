'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Brain,
  GitBranch,
  ListTodo,
  Server,
  Settings,
  Sparkles,
  BookOpen,
  FolderKanban,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { name: 'Visão geral', icon: Brain, path: '/agent-os' },
  { name: 'Uso', icon: Activity, path: '/agent-os/usage' },
  { name: 'Memória', icon: BookOpen, path: '/agent-os/memory' },
  { name: 'Conhecimento', icon: Sparkles, path: '/agent-os/knowledge' },
  { name: 'APIs OpenAPI', icon: Server, path: '/agent-os/mcp-servers' },
  { name: 'Hub MCP', icon: GitBranch, path: '/agent-os/hub' },
  { name: 'Jobs', icon: ListTodo, path: '/agent-os/jobs' },
  { name: 'Projetos', icon: FolderKanban, path: '/agent-os/projects' },
  { name: 'Configurações', icon: Settings, path: '/agent-os/settings' },
];

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/agent-os') {
      return pathname === '/agent-os';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'h-screen border-r border-subtle bg-panel flex flex-col flex-shrink-0 transition-[width] duration-200',
        isOpen ? 'w-64 overflow-hidden' : 'w-16 overflow-visible',
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          'flex items-center border-b border-subtle transition-all duration-200 select-none shrink-0',
          isOpen ? 'h-16 px-5 gap-3' : 'h-16 justify-center px-2',
        )}
      >
        <div className="flex items-center gap-3 whitespace-nowrap overflow-hidden">
          <div className="w-8 h-8 rounded-md bg-accent-muted flex items-center justify-center shrink-0 ring-1 ring-accent/30">
            <Brain className="w-4 h-4 text-accent" aria-hidden />
          </div>
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <span className="text-ink font-semibold tracking-tight text-base leading-tight">
                Agent OS
              </span>
              <span className="text-[10px] text-ink-muted font-medium leading-none mt-0.5">
                Painel pessoal
              </span>
            </div>
          )}
        </div>
      </div>

      <nav
        className={cn(
          'flex-1 py-4 space-y-0.5 transition-all duration-200',
          isOpen ? 'px-3 overflow-y-auto' : 'px-2 overflow-visible',
        )}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const href =
            item.path === '/agent-os/knowledge'
              ? '/agent-os/knowledge/skills'
              : item.path;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                router.push(href);
                onNavigate?.();
              }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'w-full flex items-center rounded-md text-sm font-medium transition-colors duration-150 relative group min-h-11',
                isOpen ? 'gap-3 px-3 py-2.5 justify-start' : 'justify-center p-3',
                active
                  ? 'bg-elevated text-ink'
                  : 'text-ink-muted hover:text-ink hover:bg-elevated/70',
              )}
              title={!isOpen ? item.name : undefined}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent"
                  aria-hidden
                />
              )}
              <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden />
              {isOpen && <span>{item.name}</span>}

              {!isOpen && (
                <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-elevated text-ink text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100 whitespace-nowrap z-[60] shadow-panel border border-subtle transition-opacity">
                  {item.name}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        className={cn(
          'border-t border-subtle whitespace-nowrap transition-all duration-200',
          isOpen ? 'p-3 overflow-hidden' : 'p-2 flex justify-center overflow-visible',
        )}
      >
        <div
          className={cn(
            'flex items-center rounded-md relative group min-h-11',
            isOpen ? 'gap-3 px-3 py-2' : 'justify-center p-2',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center border border-subtle flex-shrink-0">
            <span className="text-xs text-ink-muted font-medium">PD</span>
          </div>
          {isOpen && (
            <div className="flex flex-col text-left overflow-hidden">
              <span className="text-sm font-medium text-ink leading-tight truncate">
                Pedro
              </span>
              <span className="text-xs text-ink-muted truncate">Agent OS</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
