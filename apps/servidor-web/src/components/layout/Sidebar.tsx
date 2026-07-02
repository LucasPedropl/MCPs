'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Database, Home, Settings, Code2, Server } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { addToast } = useToast();

  const navItems = [
    { name: 'Dashboard', icon: Home, path: '/', isActive: pathname === '/' },
    { name: 'Servidores', icon: Server, path: '/', isActive: pathname.startsWith('/servers') },
    { name: 'Tools MCP', icon: Code2, isDev: true },
    { name: 'Database', icon: Database, isDev: true },
    { name: 'Settings', icon: Settings, isDev: true },
  ];

  const handleNavClick = (item: { name: string; path?: string; isDev?: boolean }) => {
    if (item.isDev) {
      addToast(`Funcionalidade "${item.name}" em desenvolvimento.`, 'info');
    } else if (item.path) {
      router.push(item.path);
    }
  };

  return (
    <aside className={cn(
      "h-screen border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#000000] flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden",
      isOpen ? "w-64" : "w-0 border-r-0"
    )}>
      <div className="h-14 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 whitespace-nowrap">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
            <span className="text-white dark:text-black font-bold text-lg leading-none">M</span>
          </div>
          <span className="text-zinc-900 dark:text-white font-semibold tracking-tight text-lg">MCP Core</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => handleNavClick(item)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              item.isActive 
                ? "bg-zinc-200 dark:bg-[#111111] text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-800/50" 
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-[#111111] border border-transparent"
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-[#111111] cursor-pointer transition-colors border border-transparent dark:hover:border-zinc-800/50">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-[#111111] flex items-center justify-center border border-zinc-300 dark:border-zinc-800 flex-shrink-0">
            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">PD</span>
          </div>
          <div className="flex flex-col text-left overflow-hidden">
            <span className="text-sm font-medium text-zinc-900 dark:text-white leading-tight truncate">Pedro Dev</span>
            <span className="text-xs text-zinc-500 truncate">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
