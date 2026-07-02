'use client';

import { useState, useEffect, useCallback } from 'react';
import { McpServerEntity } from '@/features/servers/schemas/serverSchema';
import { McpToolEntity } from '@/features/tools/schemas/toolSchema';
import { McpCategoryEntity } from '@/features/categories/schemas/categorySchema';
import { fetchServersService, updateServerAuthService, deleteServerService } from '@/features/servers/services/serversService';
import { 
  fetchToolsByServerIdService, 
  updateToolCategoryAndPromptService, 
  updateToolsBatchCategoryService, 
  updateToolAuthRequirementService, 
  updateToolsBatchAuthRequirementService 
} from '@/features/tools/services/toolsService';
import { 
  fetchCategoriesByServerIdService, 
  createCategoryService, 
  deleteCategoryService, 
  updateCategoryService 
} from '@/features/categories/services/categoriesService';

export interface AuthProfile {
  id: string;
  name: string;
  loginEndpoint: string;
  loginMethod: string;
  loginPayload: string;
  tokenPath: string;
  token?: string;
  tokenDurationMinutes?: number;
}

export interface AuthCredentials {
  authMode: string;
  profiles: AuthProfile[];
}

export interface TestLoginResult {
  success?: boolean;
  token?: string;
  error?: string;
  raw?: unknown;
}

export interface SyncReport {
  created_at: string;
  report_summary: string;
  added_endpoints: any[];
  modified_endpoints: any[];
  removed_endpoints: any[];
}

export function useServerDetails(serverId: string) {
  const [server, setServer] = useState<McpServerEntity | null>(null);
  const [tools, setTools] = useState<McpToolEntity[]>([]);
  const [categories, setCategories] = useState<McpCategoryEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- AUTH STATES ---
  const [authMode, setAuthMode] = useState<string>('none');
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isSavingAuth, setIsSavingAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [testLoginResult, setTestLoginResult] = useState<TestLoginResult | null>(null);

  // --- SYNC STATES ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);

  // --- CATEGORY CRUD STATES ---
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  // --- TOOL EDIT STATES ---
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [isSavingTool, setIsSavingTool] = useState(false);
  
  // --- FILTER & BATCH STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);
  const [isApplyingBatchAuth, setIsApplyingBatchAuth] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await fetchServersService();
      const found = list.find(s => s.id === serverId);
      if (found) {
        setServer(found);
        const [serverTools, serverCats] = await Promise.all([
          fetchToolsByServerIdService(found.id),
          fetchCategoriesByServerIdService(found.id)
        ]);
        setTools(serverTools);
        setCategories(serverCats);

        const creds = found.auth_credentials as unknown as AuthCredentials;
        if (creds) {
          setAuthMode(creds.authMode || 'none');
          if (creds.profiles && Array.isArray(creds.profiles)) {
            setProfiles(creds.profiles);
            if (creds.profiles.length > 0) {
              setSelectedProfileId(creds.profiles[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar dados do servidor:", err);
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncApi = async () => {
    if (!server || !server.swagger_url) {
      setSyncMessage({ type: 'error', text: 'URL do Swagger não configurada.' });
      return;
    }
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sync-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na sincronização.');
      
      if (data.insertedTools) setTools(prev => [...prev, ...data.insertedTools]);
      setSyncReport(data.report);
      setSyncMessage({ type: 'success', text: 'Sincronização concluída!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setSyncMessage({ type: 'error', text: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveAuth = async (creds: AuthCredentials) => {
    if (!server) return;
    setIsSavingAuth(true);
    setAuthMessage(null);
    try {
      const updated = await updateServerAuthService(
        server.id, 
        creds.authMode === 'auto_login' ? 'dashboard_login' : 'none', 
        creds as any
      );
      setServer(updated);
      setAuthMessage({ type: 'success', text: 'Configurações de autenticação salvas!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setAuthMessage({ type: 'error', text: msg });
    } finally {
      setIsSavingAuth(false);
    }
  };

  const handleTestLogin = async (profile: AuthProfile) => {
    if (!server) return;
    setIsTestingLogin(true);
    setTestLoginResult(null);
    try {
      const fullUrl = `${server.api_base_url.replace(/\/$/, '')}/${profile.loginEndpoint.replace(/^\//, '')}`;
      const res = await fetch('/api/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginUrl: fullUrl,
          method: profile.loginMethod,
          payload: profile.loginPayload,
          tokenPath: profile.tokenPath
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setTestLoginResult({ success: true, token: data.token, raw: data.rawResponse });
      return data.token;
    } catch (err: any) {
      setTestLoginResult({ error: err.message, raw: err.rawResponse });
    } finally {
      setIsTestingLogin(false);
    }
  };

  const handleCreateCategory = async (name: string, prompt: string) => {
    if (!server) return;
    setIsCreatingCat(true);
    try {
      const created = await createCategoryService({
        server_id: server.id,
        name,
        custom_prompt: prompt || null
      });
      setCategories(prev => [...prev, created]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategoryService(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      setTools(prev => prev.map(t => t.category_id === id ? { ...t, category_id: null } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCategory = async (id: string, data: Partial<McpCategoryEntity>) => {
    setIsSavingCat(true);
    try {
      const updated = await updateCategoryService(id, data);
      setCategories(prev => prev.map(c => c.id === id ? updated : c));
      setEditingCatId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleUpdateTool = async (id: string, data: Partial<McpToolEntity>) => {
    setIsSavingTool(true);
    try {
      const originalTool = tools.find(t => t.id === id);
      const catId = data.category_id !== undefined ? data.category_id : (originalTool?.category_id || null);
      const catIds = data.category_ids !== undefined ? data.category_ids : (originalTool?.category_ids || null);
      const desc = data.custom_description !== undefined ? data.custom_description : (originalTool?.custom_description || '');

      if (data.category_id !== undefined || data.category_ids !== undefined || data.custom_description !== undefined) {
        await updateToolCategoryAndPromptService(id, catId, catIds, desc);
      }
      if (data.parameters_schema) {
        await updateToolAuthRequirementService(id, data.parameters_schema);
      }
      setTools(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      setEditingToolId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTool(false);
    }
  };

  const handleBatchUpdateTools = async (
    ids: string[],
    categoryId?: string | null,
    categoryIds?: string[] | null,
    authReq?: string | string[] | null
  ) => {
    setIsApplyingBatch(true);
    setIsApplyingBatchAuth(true);
    try {
      if (categoryId !== undefined || categoryIds !== undefined) {
        await updateToolsBatchCategoryService(
          ids,
          categoryId !== undefined ? categoryId : null,
          categoryIds !== undefined ? categoryIds : null
        );
      }
      if (authReq !== undefined && authReq !== null) {
        await updateToolsBatchAuthRequirementService(ids, authReq);
      }
      setTools(prev => prev.map(t => {
        if (ids.includes(t.id)) {
          const newT = { ...t };
          if (categoryId !== undefined) newT.category_id = categoryId;
          if (categoryIds !== undefined) newT.category_ids = categoryIds;
          if (authReq !== undefined && authReq !== null) {
            newT.parameters_schema = { ...(t.parameters_schema || {}), authRequirement: authReq };
          }
          return newT;
        }
        return t;
      }));
      setSelectedToolIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsApplyingBatch(false);
      setIsApplyingBatchAuth(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!server) return;
    try {
      await deleteServerService(server.id);
      return true;
    } catch (err) {
      console.error("Erro ao deletar servidor:", err);
      throw err;
    }
  };

  return {
    server,
    tools,
    categories,
    isLoading,
    authMode, setAuthMode,
    profiles, setProfiles,
    selectedProfileId, setSelectedProfileId,
    isSavingAuth,
    authMessage, setAuthMessage,
    isTestingLogin,
    testLoginResult, setTestLoginResult,
    isSyncing,
    syncMessage, setSyncMessage,
    syncReport, setSyncReport,
    isCreatingCat,
    editingCatId, setEditingCatId,
    isSavingCat,
    editingToolId, setEditingToolId,
    isSavingTool,
    searchTerm, setSearchTerm,
    filterCategory, setFilterCategory,
    selectedToolIds, setSelectedToolIds,
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
    handleDeleteServer
  };
}
