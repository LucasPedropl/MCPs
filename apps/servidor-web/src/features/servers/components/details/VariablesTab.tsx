'use client';

import React from 'react';
import { Braces, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useTestCases } from '@/features/tests/hooks/useTestCases';

interface VariablesTabProps {
  serverId: string;
}

export function VariablesTab({ serverId }: VariablesTabProps) {
  const { testCases, isLoading } = useTestCases(serverId);

  const casesWithVars = testCases.filter(
    (tc) => tc.variables_schema && Object.keys(tc.variables_schema).length > 0,
  );

  if (isLoading) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm">
        Carregando variáveis...
      </div>
    );
  }

  if (casesWithVars.length === 0) {
    return (
      <Card className="p-8 text-center border-zinc-200 dark:border-zinc-800/80">
        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-3">
          <Braces className="w-5 h-5 text-zinc-400" />
        </div>
        <h4 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
          Nenhuma variável definida
        </h4>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Variáveis de ambiente são definidas por caso de teste na aba{' '}
          <strong>QA &amp; Testes</strong>. Cada caso pode declarar um{' '}
          <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-900 px-1 rounded">
            variables_schema
          </code>{' '}
          em JSON para reutilização entre passos.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Variáveis globais declaradas nos casos de teste desta API ({casesWithVars.length}{' '}
        {casesWithVars.length === 1 ? 'caso' : 'casos'}).
      </p>
      {casesWithVars.map((tc) => (
        <Card
          key={tc.id}
          className="p-5 border-zinc-200 dark:border-zinc-800/80 overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">{tc.name}</h4>
          </div>
          <pre className="p-4 rounded-xl bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">
            {JSON.stringify(tc.variables_schema, null, 2)}
          </pre>
        </Card>
      ))}
    </div>
  );
}
