'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  className,
  error,
  disabled
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-white dark:bg-[#050505] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-red-600 dark:border-red-900/80 focus:border-red-600 dark:focus:border-red-900/80 focus:ring-red-600 dark:focus:ring-red-900/80",
          isOpen && "border-zinc-500 ring-1 ring-zinc-500"
        )}
      >
        <span className={selectedOption ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-transform duration-200", isOpen && "transform rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 transition-colors">
          <div className="px-3 pb-2 mb-2 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center gap-2 text-zinc-400 dark:text-zinc-500 transition-colors">
            <Search className="w-4 h-4 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
              // Evita que feche ao digitar
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-60 overflow-y-auto px-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-zinc-500 px-3 py-2 text-center">Nenhum item encontrado</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white transition-colors",
                    option.value === value && "bg-zinc-100 dark:bg-[#111111] text-zinc-900 dark:text-white font-semibold border border-zinc-200 dark:border-zinc-800/50"
                  )}
                >
                  {option.label}
                  {option.value === value && <Check className="w-4 h-4 text-zinc-900 dark:text-white" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium pl-1">{error}</p>}
    </div>
  );
}
