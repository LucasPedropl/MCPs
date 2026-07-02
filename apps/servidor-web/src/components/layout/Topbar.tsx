'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeft, Search, HelpCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TopbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Topbar({ onToggleSidebar, isSidebarOpen }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  // Inferir breadcrumb da rota atual
  let subRoute = 'openapi';
  if (pathname?.startsWith('/servers/')) {
    subRoute = pathname.replace('/servers/', '');
  }

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#000000] px-4 flex items-center justify-between transition-colors z-10 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus:outline-none"
          title={isSidebarOpen ? "Recolher Menu" : "Expandir Menu"}
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-zinc-900 dark:text-white font-semibold tracking-tight">MCP Servers</span>
          <span className="text-zinc-400 dark:text-zinc-600">/</span>
          <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[150px] sm:max-w-xs">{subRoute}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Fake Search Input */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0a0a0a] text-xs text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all focus:outline-none">
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">⌘K</kbd>
        </button>

        <button className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus:outline-none">
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus:outline-none"
          title="Alternar Tema"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
