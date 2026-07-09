'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { McpServerEntity } from '../schemas/serverSchema';
import { Server, Loader2, Search, ArrowUpDown, Trash2 } from 'lucide-react';

interface ServersListProps {
  servers: McpServerEntity[];
  isLoading: boolean;
  onDeleteServer?: (id: string) => void;
  onSelectServer?: (server: McpServerEntity) => void;
}

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ServersList({ servers, isLoading, onDeleteServer }: ServersListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 dark:text-zinc-400 gap-3 transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
        <p className="text-sm font-medium">Carregando servidores MCP...</p>
      </div>
    );
  }

  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.api_base_url.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!onDeleteServer) return;
    if (!window.confirm(`Excluir o servidor "${name}"? Esta ação não pode ser desfeita.`)) return;

    try {
      setDeletingId(id);
      await onDeleteServer(id);
    } catch (err) {
      console.error('Erro ao excluir servidor:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const colSpan = onDeleteServer ? 4 : 3;

  return (
    <div className="w-full bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 rounded-xl shadow-sm overflow-hidden transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar servidores..."
            className="w-full bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 transition-colors self-end sm:self-auto">
          {filteredServers.length} {filteredServers.length === 1 ? 'servidor' : 'servidores'}
        </span>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800/80 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 tracking-wider uppercase transition-colors bg-zinc-50/50 dark:bg-[#050505]/50">
              <th className="py-3 px-6 font-medium flex items-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors">
                SERVIDOR <ArrowUpDown className="w-3 h-3" />
              </th>
              <th className="py-3 px-6 font-medium">STATUS</th>
              <th className="py-3 px-6 font-medium flex items-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors">
                CRIADO <ArrowUpDown className="w-3 h-3" />
              </th>
              {onDeleteServer && <th className="py-3 px-6 font-medium w-16" />}
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-zinc-200 dark:divide-zinc-800/80 transition-colors">
            {filteredServers.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="py-12 text-center text-zinc-500 dark:text-zinc-400 transition-colors font-medium"
                >
                  Nenhum servidor encontrado.
                </td>
              </tr>
            ) : (
              filteredServers.map((server) => (
                <tr
                  key={server.id}
                  onClick={() => router.push(`/agent-os/mcp-servers/${server.id}`)}
                  className="group hover:bg-zinc-50 dark:hover:bg-[#111111]/50 cursor-pointer transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-white flex items-center gap-3 transition-colors">
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors">
                      <Server className="w-4 h-4" />
                    </div>
                    <span className="font-semibold tracking-tight text-sm">{server.name}</span>
                  </td>
                  <td className="py-4 px-6 transition-colors">
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      <span>Ativo</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400 transition-colors font-mono text-xs">
                    {formatCreatedAt(server.created_at)}
                  </td>
                  {onDeleteServer && (
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, server.id, server.name)}
                        disabled={deletingId === server.id}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                        title="Excluir servidor"
                      >
                        {deletingId === server.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
