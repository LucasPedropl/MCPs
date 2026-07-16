'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLogin = pathname === '/login';

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  if (isLogin) {
    return (
      <div className="min-h-screen w-full bg-canvas text-ink transition-colors">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-canvas overflow-hidden text-ink transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:m-0 focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-fg focus:[clip:auto]"
      >
        Ir para o conteúdo
      </a>

      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar
          isOpen={desktopExpanded}
          onNavigate={() => undefined}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden overscroll-contain">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={closeMobile}
          />
          <div className="absolute inset-y-0 left-0 z-50 shadow-panel">
            <Sidebar isOpen onNavigate={closeMobile} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Topbar
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
              setDesktopExpanded((prev) => !prev);
            } else {
              setMobileOpen((prev) => !prev);
            }
          }}
          isSidebarOpen={desktopExpanded}
          isMobileNavOpen={mobileOpen}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-canvas p-4 md:p-8"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
