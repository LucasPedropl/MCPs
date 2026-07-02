'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { McpServerEntity } from '../../schemas/serverSchema';

interface SettingsTabProps {
  server: McpServerEntity;
  onDeleteServer: () => Promise<boolean | undefined>;
}

export function SettingsTab({ server, onDeleteServer }: SettingsTabProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { addToast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    if (confirmText !== server.name) {
      addToast('Por favor, digite o nome exato do servidor para confirmar.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      const success = await onDeleteServer();
      if (success) {
        addToast(`Servidor "${server.name}" removido com sucesso.`, 'success');
        router.push('/');
      }
    } catch (err: any) {
      addToast(err.message || 'Erro ao remover servidor.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="p-6 border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0a]">
        <CardHeader className="px-0 pt-0 pb-4 border-b border-zinc-200 dark:border-zinc-800/60 mb-6">
          <CardTitle className="text-base flex items-center gap-2 text-zinc-900 dark:text-white">
            <Settings className="w-4 h-4 text-zinc-500" />
            Configurações do Servidor
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Gerencie as preferências gerais e a integridade do servidor {server.name}.
          </CardDescription>
        </CardHeader>

        <div className="space-y-6">
          {/* Zona de Perigo */}
          <div className="p-6 rounded-2xl bg-red-50/50 dark:bg-red-950/10 border border-red-200/60 dark:border-red-900/30 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/55 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-900 dark:text-red-400">
                  Zona de Perigo: Excluir Servidor
                </h4>
                <p className="text-xs text-red-700/80 dark:text-red-300/60 mt-0.5">
                  Esta ação é permanente e não pode ser desfeita. Todos os dados associados a este servidor, incluindo as ferramentas e perfis de autenticação, serão deletados permanentemente.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-red-200/40 dark:border-red-900/20 space-y-4">
              <div className="max-w-md space-y-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Digite <code className="font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 rounded">{server.name}</code> para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Nome do servidor"
                  className="w-full bg-white dark:bg-[#050505] border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-zinc-900 dark:text-zinc-100"
                  disabled={isDeleting}
                />
              </div>

              <Button
                variant="ghost"
                onClick={handleDelete}
                isLoading={isDeleting}
                disabled={confirmText !== server.name || isDeleting}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white hover:text-white dark:bg-red-950/60 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 gap-2 font-medium"
              >
                <Trash2 className="w-4 h-4" /> Excluir Servidor MCP
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
