'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, Check, Copy, BarChart2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ConnectClientModal } from '@/features/servers/components/ConnectClientModal';
import { useServerDetails } from '@/features/servers/hooks/useServerDetails';

// Subcomponentes extraídos
import { ServerDetailsHeader } from '@/features/servers/components/details/ServerDetailsHeader';
import { SyncReportSection } from '@/features/servers/components/details/SyncReportSection';
import { AuthTab } from '@/features/servers/components/details/AuthTab';
import { CategoriesTab } from '@/features/servers/components/details/CategoriesTab';
import { ToolsTab } from '@/features/servers/components/details/ToolsTab';
import { SettingsTab } from '@/features/servers/components/details/SettingsTab';
import { TestsTab } from '@/features/servers/components/details/TestsTab';

export default function ServerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params?.id as string;

  const {
    server, tools, categories, isLoading,
    authMode, setAuthMode,
    profiles, setProfiles,
    selectedProfileId, setSelectedProfileId,
    isSavingAuth, authMessage,
    isTestingLogin, testLoginResult,
    isSyncing, syncMessage, setSyncMessage,
    syncReport, setSyncReport,
    isCreatingCat, editingCatId, setEditingCatId, isSavingCat,
    editingToolId, setEditingToolId, isSavingTool,
    searchTerm, setSearchTerm,
    filterCategory, setFilterCategory,
    selectedToolIds, setSelectedToolIds,
    isApplyingBatch, isApplyingBatchAuth,
    handleSyncApi, handleSaveAuth, handleTestLogin,
    handleCreateCategory, handleDeleteCategory, handleUpdateCategory,
    handleUpdateTool, handleBatchUpdateTools, handleDeleteServer
  } = useServerDetails(serverId);

  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'variables' | 'tools' | 'categories' | 'tests' | 'logs' | 'settings'>('overview');
  const [copied, setCopied] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const validTabs = ['overview', 'auth', 'variables', 'tools', 'categories', 'tests', 'logs', 'settings'];
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  const handleTabChange = (tab: 'overview' | 'auth' | 'variables' | 'tools' | 'categories' | 'tests' | 'logs' | 'settings') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState(null, '', url.pathname + url.search);
    }
  };
  const [connectionUrl, setConnectionUrl] = useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL 
        || (hostname === 'localhost' || hostname === '127.0.0.1' ? `${protocol}//${hostname}:3001` : `${protocol}//${window.location.host}`);
      setConnectionUrl(`${apiBaseUrl}/mcp/${serverId}`);
    }
  }, [serverId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 dark:text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Carregando detalhes do servidor...
      </div>
    );
  }

  if (!server) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Servidor nao encontrado</h3>
        <Button variant="secondary" className="mt-4" onClick={() => router.push('/')}>Voltar para Dashboard</Button>
      </div>
    );
  }

  const handleCopyEndpoint = () => {
    if (!connectionUrl) return;
    navigator.clipboard.writeText(connectionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-500">
      <ServerDetailsHeader 
        server={server} 
        mockEndpoint={connectionUrl} 
        isSyncing={isSyncing} 
        onSync={handleSyncApi} 
        onConnect={() => setIsConnectModalOpen(true)} 
      />

      {syncMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${syncMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          <p className="font-medium">{syncMessage.text}</p>
          <button onClick={() => setSyncMessage(null)} className="p-1 hover:opacity-70 text-zinc-400">Fechar</button>
        </div>
      )}

      {syncReport && <SyncReportSection report={syncReport} onClose={() => setSyncReport(null)} />}

      <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-6 text-sm font-medium overflow-x-auto custom-scrollbar">
        {(['overview', 'auth', 'variables', 'tools', 'categories', 'tests', 'logs', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`pb-3 border-b-2 capitalize transition-all ${activeTab === tab ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
          >
            {tab === 'categories' ? `Categorias (${categories.length})` : tab === 'tools' ? `Ferramentas (${tools.length})` : tab === 'auth' ? 'Autenticação' : tab === 'tests' ? 'QA & Testes' : tab === 'settings' ? 'Configurações' : tab}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-4">
                <CardTitle className="text-base">Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-mono">
                <div className="flex flex-col gap-1.5">
                  <span className="text-zinc-400 font-sans font-medium">Endpoint</span>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-zinc-800">
                    <span className="truncate">{connectionUrl || 'Carregando URL...'}</span>
                    <button onClick={handleCopyEndpoint} disabled={!connectionUrl}>{copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 flex flex-col items-center justify-center py-16 text-center border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#050505]/50 gap-4">
              <div className="p-4 rounded-full bg-zinc-100 dark:bg-[#111111] text-zinc-400 border border-zinc-200 dark:border-zinc-800/50"><BarChart2 className="w-8 h-8" /></div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-semibold">Track requests, latency, and errors</h4>
                <p className="text-sm text-zinc-500 mb-2">View tool calls, latency, and errors in Observability.</p>
                <Button variant="primary" size="sm" className="gap-2">Open Observability <ExternalLink className="w-3.5 h-3.5" /></Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'auth' && (
          <AuthTab 
            authMode={authMode} setAuthMode={setAuthMode} 
            profiles={profiles} setProfiles={setProfiles} 
            selectedProfileId={selectedProfileId} setSelectedProfileId={setSelectedProfileId} 
            isSavingAuth={isSavingAuth} authMessage={authMessage} 
            isTestingLogin={isTestingLogin} testLoginResult={testLoginResult} 
            onSaveAuth={handleSaveAuth} onTestLogin={handleTestLogin} 
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesTab 
            categories={categories} tools={tools} isCreatingCat={isCreatingCat} 
            editingCatId={editingCatId} setEditingCatId={setEditingCatId} 
            isSavingCat={isSavingCat} onCreateCategory={handleCreateCategory} 
            onDeleteCategory={handleDeleteCategory} onUpdateCategory={handleUpdateCategory} 
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab 
            tools={tools} categories={categories} profiles={profiles} 
            editingToolId={editingToolId} setEditingToolId={setEditingToolId} 
            isSavingTool={isSavingTool} searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
            filterCategory={filterCategory} setFilterCategory={setFilterCategory} 
            selectedToolIds={selectedToolIds} setSelectedToolIds={setSelectedToolIds} 
            isApplyingBatch={isApplyingBatch} isApplyingBatchAuth={isApplyingBatchAuth} 
            onUpdateTool={handleUpdateTool} onBatchUpdate={handleBatchUpdateTools} 
          />
        )}

        {activeTab === 'tests' && (
          <TestsTab 
            serverId={serverId}
            tools={tools}
            authCredentials={server.auth_credentials}
          />
        )}

        {(activeTab === 'variables' || activeTab === 'logs') && (
          <Card className="p-12 text-center text-zinc-500">
            <h4 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">{activeTab === 'variables' ? 'Variaveis de Ambiente' : 'Monitoramento'}</h4>
            <p className="text-sm">Recurso em desenvolvimento.</p>
          </Card>
        )}

        {activeTab === 'settings' && (
          <SettingsTab server={server} onDeleteServer={handleDeleteServer} />
        )}
      </div>

      <ConnectClientModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} serverName={server.name} serverId={server.id} />
    </div>
  );
}
