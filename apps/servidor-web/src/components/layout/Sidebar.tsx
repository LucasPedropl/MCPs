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
}

const NAV_ITEMS = [
  { name: 'Overview', icon: Brain, path: '/agent-os' },
  { name: 'Usage', icon: Activity, path: '/agent-os/usage' },
  { name: 'Memória', icon: BookOpen, path: '/agent-os/memory' },
  { name: 'Knowledge', icon: Sparkles, path: '/agent-os/knowledge' },
  { name: 'APIs OpenAPI', icon: Server, path: '/agent-os/mcp-servers' },
  { name: 'MCP Hub', icon: GitBranch, path: '/agent-os/hub' },
  { name: 'Jobs', icon: ListTodo, path: '/agent-os/jobs' },
  { name: 'Projetos', icon: FolderKanban, path: '/agent-os/projects' },
  { name: 'Settings', icon: Settings, path: '/agent-os/settings' },
];

export function Sidebar({ isOpen }: SidebarProps) {
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
        'h-screen border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#000000] flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden',
        isOpen ? 'w-64' : 'w-0 border-r-0',
      )}
    >
      <div className="h-14 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 whitespace-nowrap">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-white dark:text-black" />
          </div>
          <span className="text-zinc-900 dark:text-white font-semibold tracking-tight text-lg">
            Agent OS
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.name}
            onClick={() => router.push(item.path === '/agent-os/knowledge' ? '/agent-os/knowledge/skills' : item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              isActive(item.path)
                ? 'bg-zinc-200 dark:bg-[#111111] text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-800/50'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-[#111111] border border-transparent',
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-[#111111] flex items-center justify-center border border-zinc-300 dark:border-zinc-800 flex-shrink-0">
            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">PD</span>
          </div>
          <div className="flex flex-col text-left overflow-hidden">
            <span className="text-sm font-medium text-zinc-900 dark:text-white leading-tight truncate">
              Pedro
            </span>
            <span className="text-xs text-zinc-500 truncate">Personal Agent OS</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
