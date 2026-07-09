'use client';

import React from 'react';
import { X } from 'lucide-react';

interface HubModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl';
}

const widthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

export function HubModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
}: HubModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`relative w-full ${widthClass[maxWidth]} bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
