'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConnectClientModal } from '@/features/servers/components/ConnectClientModal';
import { useServerDetails } from '@/features/servers/hooks/useServerDetails';
import { ServerDetailsHeader } from '@/features/servers/components/details/ServerDetailsHeader';
import { SyncReportSection } from '@/features/servers/components/details/SyncReportSection';
import { AuthTab } from '@/features/servers/components/details/AuthTab';
import { CategoriesTab } from '@/features/servers/components/details/CategoriesTab';
import { ToolsTab } from '@/features/servers/components/details/ToolsTab';
import { SettingsTab } from '@/features/servers/components/details/SettingsTab';
import { TestsTab } from '@/features/servers/components/details/TestsTab';
import { VariablesTab } from '@/features/servers/components/details/VariablesTab';
import { LogsTab } from '@/features/servers/components/details/LogsTab';
import { ObservabilityCard } from '@/features/servers/components/details/ObservabilityCard';
import { LegacySseSection } from '@/features/servers/components/details/LegacySseSection';

type DetailTab =
  | 'overview'
  | 'auth'
  | 'variables'
  | 'tools'
  | 'categories'
  | 'tests'
  | 'logs'
  | 'settings';

export default function McpServerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params?.id as string;

  const {
    server,
    tools,
    categories,
    isLoading,
    authMode,
    setAuthMode,
    profiles,
    setProfiles,
    selectedProfileId,
    setSelectedProfileId,
    isSavingAuth,
    authMessage,
    isTestingLogin,
    testLoginResult,
    isSyncing,
    syncMessage,
    setSyncMessage,
    syncReport,
    setSyncReport,
    isCreatingCat,
    editingCatId,
    setEditingCatId,
    isSavingCat,
    editingToolId,
    setEditingToolId,
    isSavingTool,
    searchTerm,
    setSearchTerm,
    filterCategory,
    setFilterCategory,
    selectedToolIds,
    setSelectedToolIds,
    isApplyingBatch,
    isApplyingBatchAuth,
    handleSyncApi,
    handleSaveAuth,
    handleTestLogin,
    handleCreateCategory,
    handleDeleteCategory,
    handleUpdateCategory,
    handleUpdateTool,
    handleBatchUpdateTools,
    handleDeleteServer,
  } = useServerDetails(serverId);

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const tabParam = search.get('tab');
      const validTabs: DetailTab[] = [
        'overview',
        'auth',
        'variables',
        'tools',
        'categories',
        'tests',
        'logs',
        'settings',
      ];
      if (tabParam && validTabs.includes(tabParam as DetailTab)) {
        setActiveTab(tabParam as DetailTab);
      }
    }
  }, []);

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

  const handleTabChange = (tab: DetailTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState(null, '', url.pathname + url.search);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Carregando detalhes do servidor...
      </div>
    );
  }

  if (!server) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-semibold">Servidor não encontrado</h3>
        <Button variant="secondary" className="mt-4" onClick={() => router.push('/agent-os/mcp-servers')}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl w-full mx-auto animate-in fade-in duration-500">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-3 text-xs text-zinc-600 dark:text-zinc-400">
        Recomendado: exponha esta API via Agent OS com{' '}
        <code className="font-mono">register_mcp_servers</code> →{' '}
        <code className="font-mono">call_mcp_tool alias=&quot;openapi-…&quot;</code>
      </div>

      <ServerDetailsHeader
        server={server}
        mockEndpoint={connectionUrl}
        isSyncing={isSyncing}
        onSync={handleSyncApi}
        onConnect={() => setIsConnectModalOpen(true)}
      />

      {syncMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            syncMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <p className="font-medium">{syncMessage.text}</p>
          <button onClick={() => setSyncMessage(null)} className="p-1 hover:opacity-70 text-zinc-400">
            Fechar
          </button>
        </div>
      )}

      {syncReport && <SyncReportSection report={syncReport} onClose={() => setSyncReport(null)} />}

      <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-6 text-sm font-medium overflow-x-auto">
        {(
          ['overview', 'auth', 'variables', 'tools', 'categories', 'tests', 'logs', 'settings'] as const
        ).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`pb-3 border-b-2 capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {tab === 'categories'
              ? `Categorias (${categories.length})`
              : tab === 'tools'
                ? `Ferramentas (${tools.length})`
                : tab === 'auth'
                  ? 'Autenticação'
                  : tab === 'tests'
                    ? 'QA & Testes'
                    : tab === 'settings'
                      ? 'Configurações'
                      : tab === 'variables'
                        ? 'Variáveis'
                        : tab === 'logs'
                          ? 'Logs'
                          : tab === 'overview'
                            ? 'Visão Geral'
                            : tab}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <ObservabilityCard serverId={serverId} />
            <LegacySseSection connectionUrl={connectionUrl} serverId={server.id} />
          </div>
        )}

        {activeTab === 'auth' && (
          <AuthTab
            authMode={authMode}
            setAuthMode={setAuthMode}
            profiles={profiles}
            setProfiles={setProfiles}
            selectedProfileId={selectedProfileId}
            setSelectedProfileId={setSelectedProfileId}
            isSavingAuth={isSavingAuth}
            authMessage={authMessage}
            isTestingLogin={isTestingLogin}
            testLoginResult={testLoginResult}
            onSaveAuth={handleSaveAuth}
            onTestLogin={handleTestLogin}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesTab
            categories={categories}
            tools={tools}
            isCreatingCat={isCreatingCat}
            editingCatId={editingCatId}
            setEditingCatId={setEditingCatId}
            isSavingCat={isSavingCat}
            onCreateCategory={handleCreateCategory}
            onDeleteCategory={handleDeleteCategory}
            onUpdateCategory={handleUpdateCategory}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            tools={tools}
            categories={categories}
            profiles={profiles}
            editingToolId={editingToolId}
            setEditingToolId={setEditingToolId}
            isSavingTool={isSavingTool}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            selectedToolIds={selectedToolIds}
            setSelectedToolIds={setSelectedToolIds}
            isApplyingBatch={isApplyingBatch}
            isApplyingBatchAuth={isApplyingBatchAuth}
            onUpdateTool={handleUpdateTool}
            onBatchUpdate={handleBatchUpdateTools}
          />
        )}

        {activeTab === 'tests' && (
          <TestsTab serverId={serverId} tools={tools} authCredentials={server.auth_credentials} />
        )}

        {activeTab === 'variables' && <VariablesTab serverId={serverId} />}

        {activeTab === 'logs' && <LogsTab serverId={serverId} />}

        {activeTab === 'settings' && <SettingsTab server={server} onDeleteServer={handleDeleteServer} />}
      </div>

      <ConnectClientModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        serverName={server.name}
        serverId={server.id}
      />
    </div>
  );
}
