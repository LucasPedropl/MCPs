'use client';

import React from 'react';
import { Shield, Plus, CheckCircle2, AlertCircle, Key, Trash2, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { AuthProfile, AuthCredentials, TestLoginResult } from '@/features/servers/hooks/useServerDetails';

interface AuthTabProps {
  authMode: string;
  setAuthMode: (mode: string) => void;
  profiles: AuthProfile[];
  setProfiles: (profiles: AuthProfile[]) => void;
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  isSavingAuth: boolean;
  authMessage: { type: 'success' | 'error'; text: string } | null;
  isTestingLogin: boolean;
  testLoginResult: TestLoginResult | null;
  onSaveAuth: (creds: AuthCredentials) => void;
  onTestLogin: (profile: AuthProfile) => void;
}

export function AuthTab({
  authMode, setAuthMode,
  profiles, setProfiles,
  selectedProfileId, setSelectedProfileId,
  isSavingAuth,
  authMessage,
  isTestingLogin,
  testLoginResult,
  onSaveAuth,
  onTestLogin
}: AuthTabProps) {
  
  const authModeOptions = [
    { value: 'none', label: 'Nenhuma / Aberta (Sem Autenticação)' },
    { value: 'auto_login', label: 'Autenticação Automática via Proxy (Auto Login)' }
  ];

  const loginMethodOptions = [
    { value: 'POST', label: 'POST' },
    { value: 'GET', label: 'GET' }
  ];

  const handleUpdateProfileField = <K extends keyof AuthProfile>(id: string, field: K, value: AuthProfile[K]) => {
    setProfiles(profiles.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleAddProfile = () => {
    const newId = `perfil_${Date.now()}`;
    const newProfile = {
      id: newId,
      name: `Novo Perfil ${profiles.length + 1}`,
      loginEndpoint: '',
      loginMethod: 'POST',
      loginPayload: '',
      tokenPath: '',
      token: '',
      tokenDurationMinutes: undefined
    };
    setProfiles([...profiles, newProfile]);
    setSelectedProfileId(newId);
  };

  const handleDeleteProfile = (id: string) => {
    const remaining = profiles.filter(p => p.id !== id);
    setProfiles(remaining);
    if (remaining.length > 0) {
      setSelectedProfileId(remaining[0].id);
    }
  };

  const currentProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="p-6 border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0a]">
        <CardHeader className="px-0 pt-0 pb-4 border-b border-zinc-200 dark:border-zinc-800/60 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-zinc-900 dark:text-white">
                <Shield className="w-4 h-4 text-emerald-500" />
                Autenticação Automática e Gestão de Tokens (Proxy)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Configure múltiplos perfis de login para que o Proxy gerencie e injete os tokens JWT automaticamente.
              </CardDescription>
            </div>
            {authMode === 'auto_login' && (
              <Button variant="primary" size="sm" onClick={handleAddProfile} className="gap-1.5 shrink-0">
                <Plus className="w-4 h-4" /> Adicionar Perfil
              </Button>
            )}
          </div>
        </CardHeader>

        {authMessage && (
          <div className={`p-4 rounded-xl border mb-6 flex items-center gap-3 text-xs ${
            authMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200' 
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200'
          }`}>
            {authMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />}
            <p>{authMessage.text}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Modo de Autenticação do Proxy
              </label>
              <SearchableSelect
                options={authModeOptions}
                value={authMode}
                onChange={setAuthMode}
                disabled={isSavingAuth}
              />
            </div>

            {authMode === 'auto_login' && profiles.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Selecione o Perfil para Editar
                </label>
                <SearchableSelect
                  options={profiles.map(p => ({ label: `${p.name} (ID: ${p.id})`, value: p.id }))}
                  value={selectedProfileId}
                  onChange={setSelectedProfileId}
                  disabled={isSavingAuth}
                />
              </div>
            )}
          </div>

          {authMode === 'auto_login' && currentProfile && (
            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#0e1428]/20 border border-zinc-200 dark:border-indigo-900/40 space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Configurações do Perfil: {currentProfile.name}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Identificador único: <code className="font-mono text-indigo-600 dark:text-indigo-400">{currentProfile.id}</code>
                    </p>
                  </div>
                </div>
                {profiles.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProfile(currentProfile.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 px-2.5 h-8"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir Perfil
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Nome do Perfil</label>
                  <Input value={currentProfile.name} onChange={e => handleUpdateProfileField(currentProfile.id, 'name', e.target.value)} placeholder="Ex: Produção ou Cliente" disabled={isSavingAuth} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Método HTTP</label>
                  <SearchableSelect options={loginMethodOptions} value={currentProfile.loginMethod} onChange={val => handleUpdateProfileField(currentProfile.id, 'loginMethod', val)} disabled={isSavingAuth} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Rota de Login</label>
                  <Input value={currentProfile.loginEndpoint} onChange={e => handleUpdateProfileField(currentProfile.id, 'loginEndpoint', e.target.value)} placeholder="Ex: /api/v1/auth/login" disabled={isSavingAuth} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Payload (JSON)</label>
                  <textarea
                    value={currentProfile.loginPayload}
                    onChange={e => handleUpdateProfileField(currentProfile.id, 'loginPayload', e.target.value)}
                    rows={5}
                    placeholder="Ex: {&#10;  &quot;email&quot;: &quot;usuario@exemplo.com&quot;,&#10;  &quot;password&quot;: &quot;123&quot;&#10;}"
                    disabled={isSavingAuth}
                    className="w-full bg-white dark:bg-[#050505] border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Caminho do Token</label>
                  <Input value={currentProfile.tokenPath} onChange={e => handleUpdateProfileField(currentProfile.id, 'tokenPath', e.target.value)} placeholder="Ex: token ou data.token" disabled={isSavingAuth} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Duração do Token (minutos)</label>
                  <Input 
                    type="number" 
                    value={currentProfile.tokenDurationMinutes ?? ''} 
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      handleUpdateProfileField(currentProfile.id, 'tokenDurationMinutes', val);
                    }} 
                    placeholder="Ex: 60 (deixe em branco se não expirar)" 
                    disabled={isSavingAuth} 
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/60">
                <Button variant="secondary" size="sm" onClick={() => onTestLogin(currentProfile)} isLoading={isTestingLogin} disabled={isSavingAuth} className="w-full sm:w-auto gap-1.5">
                  <Send className="w-4 h-4 text-indigo-500" /> Testar Login
                </Button>
                <Button variant="primary" size="sm" onClick={() => onSaveAuth({ authMode, profiles })} isLoading={isSavingAuth} disabled={isTestingLogin} className="w-full sm:w-auto gap-1.5">
                  <Save className="w-4 h-4" /> Salvar Configurações
                </Button>
              </div>
            </div>
          )}

          {authMode !== 'auto_login' && (
            <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800/60">
              <Button variant="primary" size="sm" onClick={() => onSaveAuth({ authMode, profiles: [] })} isLoading={isSavingAuth} className="w-full sm:w-auto gap-1.5">
                <Save className="w-4 h-4" /> Salvar Modo de Autenticação
              </Button>
            </div>
          )}
        </div>

        {testLoginResult && (
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800/60 animate-in fade-in duration-300">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-500" /> Resultado do Teste
            </h4>
            {testLoginResult.error ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-900 dark:text-red-200 space-y-2 font-mono">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" /> {testLoginResult.error}
                </p>
                {!!testLoginResult.raw && <pre className="p-2.5 rounded-lg bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/40 overflow-x-auto text-[11px]">{JSON.stringify(testLoginResult.raw, null, 2)}</pre>}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 space-y-3 font-mono">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> Login efetuado com sucesso!
                </p>
                <div className="p-3 rounded-lg bg-white dark:bg-black/40 border border-emerald-200 dark:border-emerald-900/40 break-all text-[11px] select-all">{testLoginResult.token}</div>
                {!!testLoginResult.raw && (
                  <div>
                    <p className="font-semibold text-[11px] text-emerald-800 dark:text-emerald-300 mb-1">Resposta Bruta:</p>
                    <pre className="p-2.5 rounded-lg bg-white dark:bg-black/40 border border-emerald-200 dark:border-emerald-900/40 overflow-x-auto text-[11px]">{JSON.stringify(testLoginResult.raw, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
