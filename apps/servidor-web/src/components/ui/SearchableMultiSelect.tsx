'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  value: string[]; // Array of selected values
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
}

export function SearchableMultiSelect({
  options,
  value = [],
  onChange,
  placeholder = 'Selecione...',
  className,
  error,
  disabled
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (val: string) => {
    if (val === 'none') {
      onChange(['none']);
      return;
    }

    let newValue = value.filter(v => v !== 'none');
    if (newValue.includes(val)) {
      newValue = newValue.filter((v) => v !== val);
    } else {
      newValue = [...newValue, val];
    }

    if (newValue.length === 0) {
      newValue = ['none'];
    }

    onChange(newValue);
  };

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = options.filter((o) => value.includes(o.value) && o.value !== 'none');

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-white dark:bg-[#050505] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px]",
          error && "border-red-600 dark:border-red-900/80 focus:border-red-600 dark:focus:border-red-900/80 focus:ring-red-600 dark:focus:ring-red-900/80",
          isOpen && "border-zinc-500 ring-1 ring-zinc-500"
        )}
      >
        <div className="flex flex-wrap gap-1.5 max-w-[90%] text-left">
          {selectedOptions.length === 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">
              {value.includes('none') ? 'Nenhuma / Público' : placeholder}
            </span>
          ) : (
            selectedOptions.map((o) => (
              <span
                key={o.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleOption(o.value);
                }}
                className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2 py-0.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700/60 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                {o.label}
                <X className="w-3 h-3 shrink-0" />
              </span>
            ))
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-transform duration-200", isOpen && "transform rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 transition-colors">
          <div className="px-3 pb-2 mb-2 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
            <Search className="w-4 h-4 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-60 overflow-y-auto px-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-zinc-500 px-3 py-2 text-center">Nenhum item encontrado</p>
            ) : (
              filteredOptions.map((option) => {
                const isOptionSelected = value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      handleToggleOption(option.value);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white transition-colors",
                      isOptionSelected && "bg-zinc-100 dark:bg-[#111111] text-zinc-900 dark:text-white font-semibold border border-zinc-200 dark:border-zinc-800/50"
                    )}
                  >
                    {option.label}
                    {isOptionSelected && <Check className="w-4 h-4 text-zinc-900 dark:text-white" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium pl-1">{error}</p>}
    </div>
  );
}
