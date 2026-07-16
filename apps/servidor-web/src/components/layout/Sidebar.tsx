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
        'h-screen border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#000000] flex flex-col flex-shrink-0 transition-all duration-300',
        isOpen ? 'w-64 overflow-hidden' : 'w-16 overflow-visible',
      )}
    >
      <div className={cn(
        'flex items-center border-b border-zinc-200 dark:border-zinc-800/80 transition-all duration-300 select-none shrink-0',
        isOpen ? 'h-20 px-6 gap-3' : 'h-20 justify-center px-2'
      )}>
        <div className="flex items-center gap-3 whitespace-nowrap overflow-hidden">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-white dark:text-black" />
          </div>
          {isOpen && (
            <div className="flex flex-col">
              <span className="text-zinc-900 dark:text-white font-semibold tracking-tight text-lg leading-tight">
                Agent OS
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-none mt-0.5">
                Personal Dashboard
              </span>
            </div>
          )}
        </div>
      </div>

      <nav className={cn('flex-1 py-6 space-y-1 transition-all duration-300', isOpen ? 'px-4 overflow-y-auto' : 'px-2 overflow-visible')}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.name}
            onClick={() => router.push(item.path === '/agent-os/knowledge' ? '/agent-os/knowledge/skills' : item.path)}
            className={cn(
              'w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative group',
              isOpen ? 'gap-3 px-3 py-2.5 justify-start' : 'justify-center p-3',
              isActive(item.path)
                ? 'bg-zinc-200 dark:bg-[#111111] text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-800/50'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-[#111111] border border-transparent',
            )}
            title={!isOpen ? item.name : undefined}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {isOpen && <span>{item.name}</span>}
            
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-[60] shadow-lg transition-opacity">
                {item.name}
              </div>
            )}
          </button>
        ))}
      </nav>

      <div className={cn('border-t border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap transition-all duration-300', isOpen ? 'p-4 overflow-hidden' : 'p-2 flex justify-center overflow-visible')}>
        <div className={cn('flex items-center rounded-lg relative group', isOpen ? 'gap-3 px-3 py-2' : 'justify-center p-2')}>
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-[#111111] flex items-center justify-center border border-zinc-300 dark:border-zinc-800 flex-shrink-0">
            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">PD</span>
          </div>
          {isOpen && (
            <div className="flex flex-col text-left overflow-hidden">
              <span className="text-sm font-medium text-zinc-900 dark:text-white leading-tight truncate">
                Pedro
              </span>
              <span className="text-xs text-zinc-500 truncate">Personal Agent OS</span>
            </div>
          )}
          
          {/* Tooltip when collapsed */}
          {!isOpen && (
            <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-[60] shadow-lg transition-opacity">
              Pedro (Personal Agent OS)
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
