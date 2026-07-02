'use client';

import React, { useState } from 'react';
import { FolderPlus, Plus, HelpCircle, Save, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { McpCategoryEntity } from '@/features/categories/schemas/categorySchema';
import { McpToolEntity } from '@/features/tools/schemas/toolSchema';

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

interface CategoriesTabProps {
  categories: McpCategoryEntity[];
  tools: McpToolEntity[];
  isCreatingCat: boolean;
  editingCatId: string | null;
  setEditingCatId: (id: string | null) => void;
  isSavingCat: boolean;
  onCreateCategory: (name: string, prompt: string) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateCategory: (id: string, data: Partial<McpCategoryEntity>) => void;
}

export function CategoriesTab({
  categories,
  tools,
  isCreatingCat,
  editingCatId,
  setEditingCatId,
  isSavingCat,
  onCreateCategory,
  onDeleteCategory,
  onUpdateCategory
}: CategoriesTabProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatPrompt, setNewCatPrompt] = useState('');
  
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatPrompt, setEditingCatPrompt] = useState('');

  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedCats(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onCreateCategory(newCatName.trim(), newCatPrompt.trim());
    setNewCatName('');
    setNewCatPrompt('');
  };

  const startEdit = (cat: McpCategoryEntity) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatPrompt(cat.custom_prompt || '');
  };

  const handleSave = (id: string) => {
    onUpdateCategory(id, {
      name: editingCatName.trim(),
      custom_prompt: editingCatPrompt.trim() || null
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="p-6 border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0a]">
        <CardHeader className="px-0 pt-0 pb-4 border-b border-zinc-200 dark:border-zinc-800/60 mb-4">
          <CardTitle className="text-base flex items-center gap-2 text-zinc-900 dark:text-white">
            <FolderPlus className="w-4 h-4 text-indigo-500" />
            Criar Nova Categoria
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Agrupe endpoints e defina instruções globais (prompts).
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Nome da Categoria</label>
              <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ex: Cartões de Crédito" disabled={isCreatingCat} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                <span>Prompt da Categoria</span> <HelpCircle className="w-3 h-3 text-zinc-400" />
              </label>
              <Input value={newCatPrompt} onChange={(e) => setNewCatPrompt(e.target.value)} placeholder="Instruções para a IA..." disabled={isCreatingCat} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" type="submit" isLoading={isCreatingCat} className="gap-1.5">
              <Plus className="w-4 h-4" /> Cadastrar Categoria
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white px-1">Categorias Cadastradas ({categories.length})</h3>
        {categories.length === 0 ? (
          <Card className="p-12 text-center text-zinc-500 dark:text-zinc-400">
            <p className="text-sm">Nenhuma categoria cadastrada.</p>
          </Card>
        ) : (
          categories.map((cat) => {
            const catTools = tools.filter(t => t.category_ids?.includes(cat.id) || t.category_id === cat.id);
            const isExpanded = !!expandedCats[cat.id];

            return (
              <Card key={cat.id} className="p-4 bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
                {editingCatId === cat.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Nome</label>
                        <Input value={editingCatName} onChange={e => setEditingCatName(e.target.value)} disabled={isSavingCat} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Prompt</label>
                        <Input value={editingCatPrompt} onChange={e => setEditingCatPrompt(e.target.value)} disabled={isSavingCat} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingCatId(null)} disabled={isSavingCat}>Cancelar</Button>
                      <Button variant="primary" size="sm" onClick={() => handleSave(cat.id)} isLoading={isSavingCat} className="gap-1">
                        <Save className="w-3.5 h-3.5" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div 
                        className="space-y-1 max-w-2xl truncate cursor-pointer select-none flex-1"
                        onClick={() => toggleExpand(cat.id)}
                      >
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          <span>{cat.name}</span>
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold ml-2">
                            {catTools.length} {catTools.length === 1 ? 'ferramenta' : 'ferramentas'}
                          </span>
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{cat.custom_prompt || 'Sem instruções globais.'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs gap-1"
                          onClick={() => toggleExpand(cat.id)}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver ferramentas'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2.5" onClick={() => startEdit(cat)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-red-500" onClick={() => onDeleteCategory(cat.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-2">
                        {catTools.length === 0 ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 italic py-1">Nenhuma ferramenta associada a esta categoria.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                            {catTools.map(t => (
                              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50/50 dark:bg-[#070707]/30 border border-zinc-150 dark:border-zinc-800/40 text-xs">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${getMethodBadgeClass(t.http_method)}`}>
                                  {t.http_method.toUpperCase()}
                                </span>
                                <span className="font-mono text-zinc-850 dark:text-zinc-300 truncate flex-1">{t.endpoint_path}</span>
                                {t.custom_name && <span className="text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">{t.custom_name}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}

        {/* Categoria Sem Categoria / Outros */}
        {(() => {
          const uncategorizedTools = tools.filter(t => (!t.category_id) && (!t.category_ids || t.category_ids.length === 0));
          if (uncategorizedTools.length === 0) return null;
          const isExpanded = !!expandedCats['uncategorized'];

          return (
            <Card className="p-4 bg-zinc-50/40 dark:bg-[#080808]/40 border border-dashed border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div 
                    className="space-y-1 max-w-2xl truncate cursor-pointer select-none flex-1"
                    onClick={() => toggleExpand('uncategorized')}
                  >
                    <h4 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                      <span>Outros / Sem Categoria</span>
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 font-bold ml-2">
                        {uncategorizedTools.length} {uncategorizedTools.length === 1 ? 'ferramenta' : 'ferramentas'}
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">Ferramentas que ainda não foram associadas a nenhuma categoria.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs gap-1"
                      onClick={() => toggleExpand('uncategorized')}
                    >
                      {isExpanded ? 'Ocultar' : 'Ver ferramentas'}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-2">
                    <div className="grid grid-cols-1 gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                      {uncategorizedTools.map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50/50 dark:bg-[#070707]/30 border border-zinc-150 dark:border-zinc-800/40 text-xs">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${getMethodBadgeClass(t.http_method)}`}>
                            {t.http_method.toUpperCase()}
                          </span>
                          <span className="font-mono text-zinc-850 dark:text-zinc-300 truncate flex-1">{t.endpoint_path}</span>
                          {t.custom_name && <span className="text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">{t.custom_name}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
