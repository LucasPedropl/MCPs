'use client';

import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Terminal, Code2, Sparkles, MonitorSmartphone } from 'lucide-react';
import { SideSheet } from '@/components/ui/SideSheet';
import { Button } from '@/components/ui/Button';

interface ConnectClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  serverId: string;
}

type ClientId =
  | 'claude_desktop'
  | 'claude_code'
  | 'vscode'
  | 'cursor'
  | 'cline'
  | 'gemini_cli'
  | 'windsurf'
  | 'continue'
  | 'url_only';

interface ClientOption {
  id: ClientId;
  name: string;
  icon: React.ElementType;
  installPath?: string;
}

const clients: ClientOption[] = [
  {
    id: 'claude_desktop',
    name: 'Claude Desktop',
    icon: MonitorSmartphone,
    installPath: '~/Library/Application Support/Claude/claude_desktop_config.json',
  },
  { id: 'claude_code', name: 'Claude Code', icon: Terminal, installPath: '~/.claude_code/config.json' },
  { id: 'vscode', name: 'VS Code', icon: Code2, installPath: '~/.vscode/mcp_settings.json' },
  { id: 'cursor', name: 'Cursor', icon: Code2, installPath: 'Cursor Settings > Features > MCP' },
  { id: 'cline', name: 'Cline', icon: Terminal, installPath: '~/.cline/mcp_settings.json' },
  { id: 'gemini_cli', name: 'Gemini CLI', icon: Sparkles, installPath: '~/.gemini/settings.json' },
  { id: 'windsurf', name: 'Windsurf', icon: Code2, installPath: '~/.codeium/windsurf/mcp_config.json' },
  { id: 'continue', name: 'Continue', icon: Code2, installPath: '~/.continue/config.json' },
  { id: 'url_only', name: 'URL de conexão', icon: MonitorSmartphone },
];

export function ConnectClientModal({ isOpen, onClose, serverName, serverId }: ConnectClientModalProps) {
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        (hostname === 'localhost' || hostname === '127.0.0.1'
          ? `${protocol}//${hostname}:3001`
          : `${protocol}//${window.location.host}`);
      setConnectionUrl(`${apiBaseUrl}/mcp/${serverId}`);
    }
  }, [serverId]);

  const handleClose = () => {
    setSelectedClient(null);
    setCopied(false);
    onClose();
  };

  const getOpenApiAlias = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return slug ? `openapi-${slug}` : `openapi-${serverId.slice(0, 8)}`;
  };

  const getRealSnippet = (client: ClientOption) => {
    if (client.id === 'url_only') return connectionUrl || 'Carregando URL...';

    const serverAlias = getOpenApiAlias(serverName);

    return `// Recomendado: use o MCP agent-os no Cursor (sem processo separado)
// 1. Registre a API: register_mcp_servers (tool do agent-os)
// 2. Chame tools via hub com call_mcp_tool:

{
  "tool": "call_mcp_tool",
  "arguments": {
    "serverAlias": "${serverAlias}",
    "toolName": "<nome_da_tool>",
    "arguments": {}
  }
}

// server_id desta API: ${serverId}
// Alternativa legada (URL SSE direta): ${connectionUrl || '...'}`;
  };

  const handleCopy = () => {
    if (!selectedClient) return;
    navigator.clipboard.writeText(getRealSnippet(selectedClient));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SideSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={selectedClient ? selectedClient.name : 'Conectar servidor'}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {!selectedClient ? (
          <>
            <p className="text-xs text-zinc-500 mb-4">
              Recomendado: exponha via Agent OS com{' '}
              <code className="font-mono bg-zinc-100 dark:bg-zinc-900 px-1 rounded">
                register_mcp_servers
              </code>{' '}
              e chame tools com{' '}
              <code className="font-mono bg-zinc-100 dark:bg-zinc-900 px-1 rounded">
                call_mcp_tool
              </code>
              .
            </p>
            <div className="grid grid-cols-2 gap-3">
              {clients.map((client) => {
                const Icon = client.icon;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#050505] hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-[#111111] transition-all group text-left"
                  >
                    <Icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors shrink-0" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 transition-colors">
                      {client.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => {
                setSelectedClient(null);
                setCopied(false);
              }}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium -mt-2 mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Trocar cliente
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-900 dark:text-white">
                <selectedClient.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                {selectedClient.name}
              </h3>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl opacity-50 blur-sm pointer-events-none" />
              <div className="relative p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-[#1e1e1e] shadow-inner overflow-hidden">
                <pre className="text-sm font-mono text-[#d4d4d4] overflow-x-auto custom-scrollbar pb-2">
                  <code>{getRealSnippet(selectedClient)}</code>
                </pre>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleCopy}
              className="w-full h-11 text-sm font-semibold gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar snippet'}
            </Button>

            {selectedClient.installPath && (
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/80 transition-colors">
                <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-widest uppercase mb-3">
                  Como instalar
                </span>
                <p className="text-sm text-zinc-800 dark:text-zinc-300 font-medium">
                  Adicione em{' '}
                  <code className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 font-mono text-xs">
                    {selectedClient.installPath}
                  </code>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </SideSheet>
  );
}
