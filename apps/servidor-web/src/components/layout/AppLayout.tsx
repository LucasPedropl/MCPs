'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isLogin = pathname === '/login';

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  if (isLogin) {
    return (
      <div className="min-h-screen w-full bg-zinc-100 dark:bg-[#0a0a0a] text-zinc-900 dark:text-white transition-colors">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-zinc-100 dark:bg-[#000000] overflow-hidden text-zinc-900 dark:text-white transition-colors">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-[#0a0a0a] transition-colors p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
