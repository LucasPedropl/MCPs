import { supabase } from '@/lib/supabase';
import { McpServerEntity, CreateMcpServerInput } from '../schemas/serverSchema';

export async function fetchServersService(): Promise<McpServerEntity[]> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Falha ao buscar servidores MCP.');
  }

  return (data || []) as McpServerEntity[];
}

export async function createServerService(input: CreateMcpServerInput): Promise<McpServerEntity> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .insert([input])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao criar servidor MCP.');
  }

  return data as McpServerEntity;
}

export async function updateServerAuthService(
  id: string,
  auth_type: string,
  auth_credentials: any
): Promise<McpServerEntity> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .update({ auth_type, auth_credentials })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao atualizar configurações de autenticação do servidor.');
  }

  return data as McpServerEntity;
}

export async function deleteServerService(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_servers')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'Falha ao remover servidor MCP.');
  }
}
