'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Plus, Trash2, Key } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HubModal } from './HubModal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { HubConnection } from '../types/hub';

interface EditConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: HubConnection | null;
  onSuccess: () => void;
  onError: (message: string) => void;
}

interface EnvRow {
  key: string;
  value: string;
  visible: boolean;
}

export function EditConnectionModal({
  isOpen,
  onClose,
  connection,
  onSuccess,
  onError,
}: EditConnectionModalProps) {
  const { addToast } = useToast();
  const [command, setCommand] = useState('');
  const [argsRaw, setArgsRaw] = useState('');
  const [url, setUrl] = useState('');
  const [sseUrl, setSseUrl] = useState('');
  const [serverId, setServerId] = useState('');
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [headerRows, setHeaderRows] = useState<EnvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Estados de login do Supabase
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthing, setIsAuthing] = useState(false);

  useEffect(() => {
    // Preenche o email logado no dashboard para facilitar
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data: { email?: string }) => {
        if (data.email) setAuthEmail(data.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (connection) {
      const config = connection.config_json || {};
      setCommand(String(config.command ?? 'npx'));
      
      const args = config.args;
      if (Array.isArray(args)) {
        setArgsRaw(args.join(', '));
      } else {
        setArgsRaw('');
      }

      setUrl(String(config.url ?? config.http_url ?? ''));
      setSseUrl(String(config.sse_url ?? ''));
      setServerId(String(config.server_id ?? ''));

      const envObj = (config.env as Record<string, string>) || {};
      const rows = Object.entries(envObj).map(([key, value]) => {
        const isSensitive = 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('pass');
        return {
          key,
          value,
          visible: !isSensitive,
        };
      });
      setEnvRows(rows);

      const headersObj = (config.headers as Record<string, string>) || {};
      const hRows = Object.entries(headersObj).map(([key, value]) => {
        const isSensitive = 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('auth') || 
          key.toLowerCase().includes('pass');
        return {
          key,
          value,
          visible: !isSensitive,
        };
      });
      setHeaderRows(hRows);
    }
  }, [connection]);

  if (!connection) return null;

  const handleAddEnvRow = () => {
    setEnvRows([...envRows, { key: '', value: '', visible: true }]);
  };

  const handleRemoveEnvRow = (index: number) => {
    setEnvRows(envRows.filter((_, i) => i !== index));
  };

  const handleUpdateEnvRow = (index: number, field: 'key' | 'value', val: string) => {
    setEnvRows(
      envRows.map((row, i) => (i === index ? { ...row, [field]: val } : row))
    );
  };

  const handleToggleVisibility = (index: number) => {
    setEnvRows(
      envRows.map((row, i) => (i === index ? { ...row, visible: !row.visible } : row))
    );
  };

  const handleAddHeaderRow = () => {
    setHeaderRows([...headerRows, { key: '', value: '', visible: true }]);
  };

  const handleRemoveHeaderRow = (index: number) => {
    setHeaderRows(headerRows.filter((_, i) => i !== index));
  };

  const handleUpdateHeaderRow = (index: number, field: 'key' | 'value', val: string) => {
    setHeaderRows(
      headerRows.map((row, i) => (i === index ? { ...row, [field]: val } : row))
    );
  };

  const handleToggleHeaderVisibility = (index: number) => {
    setHeaderRows(
      headerRows.map((row, i) => (i === index ? { ...row, visible: !row.visible } : row))
    );
  };

  // Login com Google no Supabase (OAuth Redirect)
  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin + '/agent-os/hub' : undefined,
        },
      });
    } catch (err: any) {
      onError(err.message ?? 'Erro ao iniciar login com Google');
    }
  };

  // Login com Email/Senha no Supabase (Client-side)
  const handleSupabaseLogin = async () => {
    if (!authEmail || !authPassword) {
      onError('Email e senha são necessários para autenticação.');
      return;
    }
    setIsAuthing(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        onError(error.message);
        return;
      }

      const token = data.session?.access_token;
      if (!token) {
        onError('Nenhum token de sessão retornado do Supabase.');
        return;
      }

      // Procura se o Authorization header já existe, senão cria
      const exists = headerRows.some((r) => r.key.toLowerCase() === 'authorization');
      if (exists) {
        setHeaderRows(
          headerRows.map((r) =>
            r.key.toLowerCase() === 'authorization'
              ? { ...r, value: `Bearer ${token}` }
              : r
          )
        );
      } else {
        setHeaderRows([
          ...headerRows,
          { key: 'Authorization', value: `Bearer ${token}`, visible: false },
        ]);
      }

      addToast('Autenticado com sucesso! O token foi preenchido no cabeçalho Authorization.', 'success');
      setAuthPassword(''); // Limpa a senha
    } catch (err: any) {
      onError(err.message ?? 'Erro na autenticação client-side');
    } finally {
      setIsAuthing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const config_json: Record<string, unknown> = {};

      if (connection.transport === 'stdio') {
        const env: Record<string, string> = {};
        for (const row of envRows) {
          if (row.key.trim()) {
            env[row.key.trim()] = row.value;
          }
        }
        
        config_json.command = command.trim();
        config_json.args = argsRaw
          .split(',')
          .map((arg) => arg.trim())
          .filter(Boolean);
        config_json.env = env;
      } else if (connection.transport === 'http') {
        if (url.trim()) config_json.url = url.trim();
        if (sseUrl.trim()) config_json.sse_url = sseUrl.trim();

        const headers: Record<string, string> = {};
        for (const row of headerRows) {
          if (row.key.trim()) {
            headers[row.key.trim()] = row.value;
          }
        }
        config_json.headers = headers;
      } else if (connection.transport === 'openapi') {
        if (serverId.trim()) config_json.server_id = serverId.trim();
      }

      const res = await fetch('/api/agent-os/hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: connection.alias,
          transport: connection.transport,
          config_json,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Falha ao salvar configurações do MCP');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar formulário';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400';

  return (
    <HubModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Conexão MCP: ${connection.alias}`}
      description={`Modifique comandos, argumentos e configure autenticação/credenciais do tipo ${connection.transport}.`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {connection.transport === 'stdio' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500 font-medium">Comando</span>
                <input
                  className={inputClass}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500 font-medium">Argumentos (separados por vírgula)</span>
                <input
                  className={inputClass}
                  value={argsRaw}
                  onChange={(e) => setArgsRaw(e.target.value)}
                  placeholder="-y, @modelcontextprotocol/server-github"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-subtle pb-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-accent" />
                  Variáveis de Ambiente / Autenticação (env)
                </h4>
                <button
                  type="button"
                  onClick={handleAddEnvRow}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-85 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Variável
                </button>
              </div>

              {envRows.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-4 bg-panel border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  Nenhuma variável de ambiente definida.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {envRows.map((row, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="CHAVE"
                          value={row.key}
                          onChange={(e) => handleUpdateEnvRow(index, 'key', e.target.value)}
                          className="font-mono text-xs uppercase"
                        />
                      </div>
                      <div className="flex-[2] relative flex items-center">
                        <Input
                          type={row.visible ? 'text' : 'password'}
                          placeholder="Valor / Token"
                          value={row.value}
                          onChange={(e) => handleUpdateEnvRow(index, 'value', e.target.value)}
                          className="font-mono text-xs pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(index)}
                          className="absolute right-3 text-ink-muted hover:text-ink transition-colors"
                          title={row.visible ? 'Ocultar valor' : 'Mostrar valor'}
                        >
                          {row.visible ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvRow(index)}
                        className="p-2.5 rounded-lg border border-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors text-ink-muted shrink-0"
                        title="Remover variável"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {connection.transport === 'http' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500 font-medium">URL (Modern HTTP / Streamable)</span>
                <input
                  className={inputClass}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://sua-api.com/mcp"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500 font-medium">SSE URL (Legacy Fallback)</span>
                <input
                  className={inputClass}
                  type="url"
                  value={sseUrl}
                  onChange={(e) => setSseUrl(e.target.value)}
                  placeholder="https://sua-api.com/mcp/sse"
                />
              </label>
            </div>

            {/* Nova seção de Autenticação Rápida */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900/20 space-y-4">
              <div className="flex items-center gap-2 border-b border-subtle pb-2">
                <Key className="w-4 h-4 text-emerald-500" />
                <h5 className="text-xs font-semibold uppercase tracking-wider text-ink">Autenticação Simplificada (Supabase/Google)</h5>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Este MCP (como o Contendeo) é hospedado no mesmo projeto Supabase do Agent OS. Você pode se autenticar para obter o token e injetá-lo automaticamente no cabeçalho <code>Authorization</code>.
              </p>
              
              <div className="flex flex-wrap gap-4 items-end">
                <Button 
                  type="button" 
                  onClick={handleGoogleLogin} 
                  className="bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 gap-2 text-xs h-9 px-4"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Logar com Google
                </Button>

                <div className="flex-1 min-w-[200px] border-l border-subtle pl-4 space-y-2">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase block">Ou via Email/Senha</span>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Sua senha do Agent OS"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button 
                      type="button" 
                      onClick={handleSupabaseLogin} 
                      isLoading={isAuthing} 
                      disabled={!authPassword.trim()}
                      className="text-xs h-9 px-4 shrink-0"
                    >
                      Logar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-subtle pb-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-accent" />
                  Cabeçalhos HTTP / Autenticação (Headers)
                </h4>
                <button
                  type="button"
                  onClick={handleAddHeaderRow}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-85 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Cabeçalho
                </button>
              </div>

              {headerRows.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-4 bg-panel border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  Nenhum cabeçalho HTTP definido (conexão aberta).
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {headerRows.map((row, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="Authorization, x-api-key, etc."
                          value={row.key}
                          onChange={(e) => handleUpdateHeaderRow(index, 'key', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="flex-[2] relative flex items-center">
                        <Input
                          type={row.visible ? 'text' : 'password'}
                          placeholder="Valor / Token"
                          value={row.value}
                          onChange={(e) => handleUpdateHeaderRow(index, 'value', e.target.value)}
                          className="font-mono text-xs pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleHeaderVisibility(index)}
                          className="absolute right-3 text-ink-muted hover:text-ink transition-colors"
                          title={row.visible ? 'Ocultar valor' : 'Mostrar valor'}
                        >
                          {row.visible ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveHeaderRow(index)}
                        className="p-2.5 rounded-lg border border-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors text-ink-muted shrink-0"
                        title="Remover cabeçalho"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {connection.transport === 'openapi' && (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs text-zinc-500 font-medium font-mono">Server ID (mcp_servers)</span>
              <input
                className={inputClass}
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                required
              />
            </label>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-panel text-xs text-ink-muted">
              ℹ️ Conexões OpenAPI utilizam perfis de autenticação dinâmica (Bearer Tokens/OAuth) gerenciados no menu principal <strong>APIs OpenAPI → MCP</strong>. Para autenticar esta conexão, visite a aba correspondente do servidor OpenAPI cadastrado.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={submitting}>
            Salvar Alterações
          </Button>
        </div>
      </form>
    </HubModal>
  );
}
