'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 p-4 rounded-lg border shadow-[var(--shadow-panel)] transition-all duration-300 animate-in fade-in slide-in-from-top-5',
              toast.type === 'success' &&
                'bg-panel border-success/30 text-success',
              toast.type === 'error' &&
                'bg-panel border-danger/30 text-danger',
              toast.type === 'info' &&
                'bg-panel border-subtle text-ink',
            )}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-hidden />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-danger shrink-0" aria-hidden />
            )}
            {toast.type === 'info' && (
              <Info className="w-5 h-5 text-accent shrink-0" aria-hidden />
            )}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((p) => p.filter((t) => t.id !== toast.id))}
              className="text-ink-muted hover:text-ink transition-colors min-h-9 min-w-9 inline-flex items-center justify-center"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
}
