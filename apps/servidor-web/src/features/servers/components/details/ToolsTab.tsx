'use client';

import React, { useState } from 'react';
import { Search, Filter, Layers, Shield, X, CheckSquare, Square, Edit2, Key, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import { McpToolEntity } from '@/features/tools/schemas/toolSchema';
import { McpCategoryEntity } from '@/features/categories/schemas/categorySchema';
import { AuthProfile } from '@/features/servers/hooks/useServerDetails';

const getMethodBadgeClass = (method: string) => {
  const m = method.toUpperCase();
  switch (m) {
    case 'GET':
      return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20';
    case 'POST':
      return 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20';
    case 'PUT':
      return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20';
    case 'PATCH':
      return 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 border border-orange-500/20';
    case 'DELETE':
      return 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border border-red-500/20';
    default:
      return 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400 border border-zinc-500/20';
  }
};

interface ToolsTabProps {
  tools: McpToolEntity[];
  categories: McpCategoryEntity[];
  profiles: AuthProfile[];
  editingToolId: string | null;
  setEditingToolId: (id: string | null) => void;
  isSavingTool: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
  selectedToolIds: string[];
  setSelectedToolIds: (ids: string[]) => void;
  isApplyingBatch: boolean;
  isApplyingBatchAuth: boolean;
  onUpdateTool: (id: string, data: Partial<McpToolEntity>) => void;
  onBatchUpdate: (ids: string[], catId?: string | null, categoryIds?: string[] | null, authReq?: string | string[] | null) => void;
}

export function ToolsTab({
  tools, categories, profiles,
  editingToolId, setEditingToolId, isSavingTool,
  searchTerm, setSearchTerm,
  filterCategory, setFilterCategory,
  selectedToolIds, setSelectedToolIds,
  isApplyingBatch, isApplyingBatchAuth,
  onUpdateTool, onBatchUpdate
}: ToolsTabProps) {
  
  const [editingToolCats, setEditingToolCats] = useState<string[]>(['none']);
  const [editingToolDesc, setEditingToolDesc] = useState<string>('');
  const [editingToolAuthReq, setEditingToolAuthReq] = useState<string[]>(['none']);

  const [batchTargetCategories, setBatchTargetCategories] = useState<string[]>(['keep']);
  const [batchTargetAuthReq, setBatchTargetAuthReq] = useState<string[]>(['keep']);

  const [filterAuth, setFilterAuth] = useState<string>('all');

  const filteredTools = tools.filter(tool => {
    // Filtro por Categoria
    if (filterCategory === 'none') {
      const hasCategories = (tool.category_id !== null && tool.category_id !== undefined) || (tool.category_ids && tool.category_ids.length > 0);
      if (hasCategories) return false;
    }
    if (filterCategory !== 'all' && filterCategory !== 'none') {
      const match = tool.category_id === filterCategory || tool.category_ids?.includes(filterCategory);
      if (!match) return false;
    }

    // Filtro por Autenticação
    const rawAuth = tool.parameters_schema?.authRequirement;
    const authReqList = Array.isArray(rawAuth)
      ? rawAuth
      : (typeof rawAuth === 'string' ? [rawAuth] : ['none']);
    
    if (filterAuth !== 'all') {
      if (filterAuth === 'none') {
        const isPublic = authReqList.length === 0 || authReqList.includes('none');
        if (!isPublic) return false;
      } else {
        if (!authReqList.includes(filterAuth)) return false;
      }
    }

    // Filtro por termo de busca
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return tool.endpoint_path.toLowerCase().includes(term) || tool.custom_name.toLowerCase().includes(term);
  });

  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const sortedProfiles = [...profiles].sort((a, b) => a.name.localeCompare(b.name));

  const categoryOptions = [
    { value: 'none', label: 'Sem Categoria' },
    ...sortedCategories.map(c => ({ value: c.id, label: c.name }))
  ];

  const batchCategoryOptions = [
    { value: 'keep', label: '— Manter Categoria Atual —' },
    ...categoryOptions
  ];

  const filterOptions = [
    { value: 'all', label: 'Todas as Categorias' },
    ...categoryOptions
  ];

  const filterAuthOptions = [
    { value: 'all', label: 'Todas as Autenticações' },
    { value: 'none', label: 'Nenhuma / Público' },
    ...sortedProfiles.map(p => ({ value: p.id, label: `Perfil: ${p.name}` }))
  ];

  const authOptions = [
    { value: 'none', label: 'Nenhuma / Público' },
    ...sortedProfiles.map(p => ({ value: p.id, label: `Perfil: ${p.name}` }))
  ];

  const batchAuthOptions = [
    { value: 'keep', label: '— Manter Autenticação Atual —' },
    ...authOptions
  ];

  const handleBatchCategoryChange = (val: string[]) => {
    if (val.includes('keep') && val.length > 1) {
      const hadKeep = batchTargetCategories.includes('keep');
      if (hadKeep) {
        setBatchTargetCategories(val.filter(v => v !== 'keep'));
      } else {
        setBatchTargetCategories(['keep']);
      }
    } else {
      setBatchTargetCategories(val);
    }
  };

  const handleBatchAuthChange = (val: string[]) => {
    if (val.includes('keep') && val.length > 1) {
      const hadKeep = batchTargetAuthReq.includes('keep');
      if (hadKeep) {
        setBatchTargetAuthReq(val.filter(v => v !== 'keep'));
      } else {
        setBatchTargetAuthReq(['keep']);
      }
    } else {
      setBatchTargetAuthReq(val);
    }
  };

  const handleBatchApply = () => {
    let finalCat: string | null | undefined = undefined;
    let finalCats: string[] | null | undefined = undefined;

    if (!batchTargetCategories.includes('keep')) {
      const selectedCats = batchTargetCategories.filter(c => c !== 'none');
      finalCats = selectedCats;
      finalCat = selectedCats.length > 0 ? selectedCats[0] : null;
    }

    let finalAuth: string[] | undefined = undefined;
    if (!batchTargetAuthReq.includes('keep')) {
      finalAuth = batchTargetAuthReq.filter(a => a !== 'none');
      if (finalAuth.length === 0) {
        finalAuth = ['none'];
      }
    }

    onBatchUpdate(selectedToolIds, finalCat, finalCats, finalAuth);
    setBatchTargetCategories(['keep']);
    setBatchTargetAuthReq(['keep']);
  };

  const handleSelectAll = () => {
    if (selectedToolIds.length === filteredTools.length) setSelectedToolIds([]);
    else setSelectedToolIds(filteredTools.map(t => t.id));
  };

  const handleSelectOne = (id: string) => {
    if (selectedToolIds.includes(id)) setSelectedToolIds(selectedToolIds.filter(i => i !== id));
    else setSelectedToolIds([...selectedToolIds, id]);
  };

  const startEdit = (tool: McpToolEntity) => {
    setEditingToolId(tool.id);
    
    const initialCats: string[] = [];
    if (tool.category_id) initialCats.push(tool.category_id);
    if (tool.category_ids && Array.isArray(tool.category_ids)) {
      tool.category_ids.forEach(id => {
        if (!initialCats.includes(id)) initialCats.push(id);
      });
    }
    if (initialCats.length === 0) initialCats.push('none');

    setEditingToolCats(initialCats);
    setEditingToolDesc(tool.custom_description || '');
    const rawAuth = tool.parameters_schema?.authRequirement;
    const initialAuth = Array.isArray(rawAuth)
      ? rawAuth
      : (typeof rawAuth === 'string' ? [rawAuth] : ['none']);
    setEditingToolAuthReq(initialAuth);
  };

  const handleSaveEdit = (id: string) => {
    let finalAuth = editingToolAuthReq.filter(a => a !== 'none');
    if (finalAuth.length === 0) {
      finalAuth = ['none'];
    }

    const finalCats = editingToolCats.filter(c => c !== 'none');

    onUpdateTool(id, {
      category_id: finalCats.length > 0 ? finalCats[0] : null,
      category_ids: finalCats,
      custom_description: editingToolDesc.trim(),
      parameters_schema: { ...(tools.find(t => t.id === id)?.parameters_schema || {}), authRequirement: finalAuth }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Gerenciamento de Ferramentas ({filteredTools.length})</h3>
      </div>

      <Card className="p-4 bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Pesquisar</label>
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rota ou nome..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Categoria</label>
            <SearchableSelect options={filterOptions} value={filterCategory} onChange={setFilterCategory} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Autenticação</label>
            <SearchableSelect options={filterAuthOptions} value={filterAuth} onChange={setFilterAuth} />
          </div>
        </div>
      </Card>

      {selectedToolIds.length > 0 && (
        <Card className="p-4 bg-indigo-50 dark:bg-[#0e1428] border border-indigo-200 dark:border-indigo-900/60 shadow-lg sticky top-4 z-40 space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-indigo-200 dark:border-indigo-900/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500 text-white font-bold text-xs">{selectedToolIds.length}</div>
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Selecionadas</h4>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedToolIds([])}><X className="w-4 h-4 mr-1" /> Limpar</Button>
          </div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-4 justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:flex-1">
              <div>
                <label className="block text-xs font-semibold text-indigo-900 dark:text-indigo-200 mb-1.5">Alterar Categoria</label>
                <SearchableMultiSelect options={batchCategoryOptions} value={batchTargetCategories} onChange={handleBatchCategoryChange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-indigo-900 dark:text-indigo-200 mb-1.5">Alterar Autenticação</label>
                <SearchableMultiSelect options={batchAuthOptions} value={batchTargetAuthReq} onChange={handleBatchAuthChange} />
              </div>
            </div>
            <Button 
              size="sm"
              variant="primary"
              className="w-full md:w-auto mt-2 md:mt-0 font-semibold px-6 shadow-md gap-2 h-9"
              onClick={handleBatchApply}
              isLoading={isApplyingBatch || isApplyingBatchAuth}
            >
              <Save className="w-4 h-4" /> Aplicar Alterações em Lote
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between px-2 py-1 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
          <button onClick={handleSelectAll} className="flex items-center gap-2 font-medium">
            {selectedToolIds.length === filteredTools.length ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
            Selecionar Todos ({filteredTools.length})
          </button>
        </div>

        {filteredTools.map((tool) => {
          const catObj = categories.find(c => c.id === tool.category_id);
          const isSelected = selectedToolIds.includes(tool.id);
          const authReq = tool.parameters_schema?.authRequirement || 'none';
          const authProfileObj = profiles.find(p => p.id === authReq);

          return (
            <div 
              key={tool.id} 
              onContextMenu={(e) => {
                e.preventDefault();
                handleSelectOne(tool.id);
              }}
              onClick={(e) => {
                if (selectedToolIds.length > 0) {
                  if (editingToolId === tool.id) return;
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea')) {
                    return;
                  }
                  handleSelectOne(tool.id);
                }
              }}
              className={`flex flex-col gap-3 p-4 rounded-xl bg-white dark:bg-[#0a0a0a] border transition-all ${selectedToolIds.length > 0 ? 'cursor-pointer select-none' : ''} ${isSelected ? 'border-accent ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800/60 pb-3">
                <div className="flex items-center gap-3 truncate">
                  <button onClick={() => handleSelectOne(tool.id)}>{isSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}</button>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getMethodBadgeClass(tool.http_method)}`}>{tool.http_method.toUpperCase()}</span>
                  <span className="text-xs font-mono truncate">{tool.endpoint_path}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const rawAuth = tool.parameters_schema?.authRequirement;
                    const authReqList = Array.isArray(rawAuth)
                      ? rawAuth
                      : (typeof rawAuth === 'string' ? [rawAuth] : ['none']);
                    
                    const isPublic = authReqList.length === 0 || authReqList.includes('none');

                    if (isPublic) {
                      return (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Público
                        </span>
                      );
                    }

                    return (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] flex items-center gap-1 flex-wrap">
                        <Key className="w-3 h-3 text-accent mr-0.5" />
                        {authReqList.map((reqId, idx) => {
                          const prof = profiles.find(p => p.id === reqId);
                          return (
                            <span key={reqId} className="font-semibold text-accent">
                              {prof ? prof.name : reqId}
                              {idx < authReqList.length - 1 && <span className="text-zinc-400 dark:text-zinc-600 mx-1">/</span>}
                            </span>
                          );
                        })}
                      </span>
                    );
                  })()}
                  {(() => {
                    const associatedCatIds = new Set<string>();
                    if (tool.category_id) associatedCatIds.add(tool.category_id);
                    if (tool.category_ids && Array.isArray(tool.category_ids)) {
                      tool.category_ids.forEach(id => associatedCatIds.add(id));
                    }
                    const associatedCats = categories.filter(c => associatedCatIds.has(c.id));
                    if (associatedCats.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {associatedCats.map(cat => (
                          <span key={cat.id} className="px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                            📁 {cat.name}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => startEdit(tool)}><Edit2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {editingToolId === tool.id ? (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Categorias</label>
                      <SearchableMultiSelect options={categoryOptions} value={editingToolCats} onChange={setEditingToolCats} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Autenticação</label>
                      <SearchableMultiSelect options={authOptions} value={editingToolAuthReq} onChange={setEditingToolAuthReq} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Descrição</label>
                      <Input value={editingToolDesc} onChange={e => setEditingToolDesc(e.target.value)} placeholder="Descrição..." />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingToolId(null)}>Cancelar</Button>
                    <Button variant="primary" size="sm" onClick={() => handleSaveEdit(tool.id)} isLoading={isSavingTool}><Save className="w-3.5 h-3.5 mr-1" /> Salvar</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div><span className="text-zinc-400 block mb-1">Nome</span><div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 font-mono">{tool.custom_name}</div></div>
                  <div><span className="text-zinc-400 block mb-1">Prompt</span><div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40">{tool.custom_description || 'Sem descrição'}</div></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
