import { supabase } from '@/lib/supabase';
import { McpToolEntity, CreateMcpToolInput } from '../schemas/toolSchema';

export async function fetchToolsByServerIdService(serverId: string): Promise<McpToolEntity[]> {
  const { data, error } = await supabase
    .from('mcp_tools')
    .select('*')
    .eq('server_id', serverId)
    .order('endpoint_path', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Falha ao buscar ferramentas do servidor.');
  }

  return (data || []) as McpToolEntity[];
}

export async function insertToolsBatchService(tools: CreateMcpToolInput[]): Promise<McpToolEntity[]> {
  const { data, error } = await supabase
    .from('mcp_tools')
    .insert(tools)
    .select();

  if (error) {
    throw new Error(error.message || 'Falha ao salvar ferramentas em lote no Supabase.');
  }

  return data as McpToolEntity[];
}

export async function updateToolCategoryAndPromptService(
  id: string,
  category_id: string | null,
  category_ids: string[] | null,
  custom_description: string
): Promise<McpToolEntity> {
  const { data, error } = await supabase
    .from('mcp_tools')
    .update({ category_id, category_ids, custom_description })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao atualizar ferramenta.');
  }

  return data as McpToolEntity;
}

export async function updateToolsBatchCategoryService(
  ids: string[],
  category_id: string | null,
  category_ids: string[] | null
): Promise<void> {
  const { error } = await supabase
    .from('mcp_tools')
    .update({ category_id, category_ids })
    .in('id', ids);

  if (error) {
    throw new Error(error.message || 'Falha ao atualizar ferramentas em lote.');
  }
}

export async function deleteToolService(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_tools')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'Falha ao remover ferramenta.');
  }
}

export async function updateToolAuthRequirementService(
  id: string,
  parameters_schema: any
): Promise<McpToolEntity> {
  const { data, error } = await supabase
    .from('mcp_tools')
    .update({ parameters_schema })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao atualizar requisito de autenticação da ferramenta.');
  }

  return data as McpToolEntity;
}

export async function updateToolsBatchAuthRequirementService(
  ids: string[],
  authRequirement: string | string[]
): Promise<void> {
  const { data: tools, error: fetchErr } = await supabase
    .from('mcp_tools')
    .select('id, parameters_schema')
    .in('id', ids);

  if (fetchErr || !tools) {
    throw new Error(fetchErr?.message || 'Falha ao buscar ferramentas para atualização em lote.');
  }

  await Promise.all(
    tools.map(t => {
      const newSchema = { ...(t.parameters_schema || {}), authRequirement };
      return supabase.from('mcp_tools').update({ parameters_schema: newSchema }).eq('id', t.id);
    })
  );
}
