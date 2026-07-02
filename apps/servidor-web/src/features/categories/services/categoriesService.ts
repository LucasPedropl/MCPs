import { supabase } from '@/lib/supabase';
import { McpCategoryEntity, CreateMcpCategoryInput, UpdateMcpCategoryInput } from '../schemas/categorySchema';

export async function fetchCategoriesByServerIdService(serverId: string): Promise<McpCategoryEntity[]> {
  const { data, error } = await supabase
    .from('mcp_categories')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Falha ao buscar categorias.');
  }

  return (data || []) as McpCategoryEntity[];
}

export async function createCategoryService(input: CreateMcpCategoryInput): Promise<McpCategoryEntity> {
  const { data, error } = await supabase
    .from('mcp_categories')
    .insert([input])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao criar categoria.');
  }

  return data as McpCategoryEntity;
}

export async function updateCategoryService(id: string, input: UpdateMcpCategoryInput): Promise<McpCategoryEntity> {
  const { data, error } = await supabase
    .from('mcp_categories')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao atualizar categoria.');
  }

  return data as McpCategoryEntity;
}

export async function deleteCategoryService(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_categories')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'Falha ao remover categoria.');
  }
}
