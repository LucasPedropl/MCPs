'use client';

import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ToolsBatchFormData } from '../schemas/toolSchema';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface ToolEditRowProps {
  index: number;
  originalName: string;
  httpMethod: string;
  endpointPath: string;
  register: UseFormRegister<ToolsBatchFormData>;
  errors?: FieldErrors<ToolsBatchFormData>;
}

export function ToolEditRow({ index, originalName, httpMethod, endpointPath, register, errors }: ToolEditRowProps) {
  const methodColor = {
    GET: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    POST: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    PATCH: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    DELETE: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    PUT: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  }[httpMethod.toUpperCase()] || 'bg-slate-500/10 border-slate-500/30 text-slate-400';

  const toolError = errors?.tools?.[index];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800/60 pb-3 transition-colors">
        <div className="flex items-center gap-2.5 truncate">
          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border font-mono tracking-wider shrink-0", methodColor)}>
            {httpMethod.toUpperCase()}
          </span>
          <span className="text-xs font-mono text-zinc-800 dark:text-zinc-300 truncate transition-colors">{endpointPath}</span>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono transition-colors">Original: {originalName}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 transition-colors">Nome Personalizado (Tool Name)</label>
          <Input
            {...register(`tools.${index}.custom_name`)}
            placeholder="Ex: get_empresa"
            error={toolError?.custom_name?.message}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 transition-colors">Instrucoes para IA (Prompt / Descricao)</label>
          <Input
            {...register(`tools.${index}.custom_description`)}
            placeholder="Ex: Retorna os dados cadastrais da empresa"
            error={toolError?.custom_description?.message}
          />
        </div>
      </div>
    </div>
  );
}
