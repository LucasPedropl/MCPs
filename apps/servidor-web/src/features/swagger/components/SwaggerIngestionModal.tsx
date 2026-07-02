'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SwaggerIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function SwaggerIngestionModal({ isOpen, onClose, children }: SwaggerIngestionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 transition-colors max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-200 dark:border-zinc-800/80 transition-colors">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight transition-colors">
              Adicionar Novo Servidor MCP
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 transition-colors">
              Importe uma especificacao OpenAPI/Swagger para gerar as ferramentas de IA.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-2">
          {children}
        </div>
      </div>
    </div>
  );
}
