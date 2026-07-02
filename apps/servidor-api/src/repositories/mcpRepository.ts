import { supabaseAdmin } from '../config/supabase.js';

export interface ServerRecord {
  id: string;
  name: string;
  swagger_url: string;
  api_base_url: string;
  auth_type: string;
  auth_credentials: any;
}

export interface CategoryRecord {
  id: string;
  server_id: string;
  name: string;
  custom_prompt?: string | null;
  created_at: string;
}

export interface ToolRecord {
  id: string;
  server_id: string;
  category_id?: string | null;
  category_ids?: string[] | null;
  original_name: string;
  custom_name: string;
  custom_description: string;
  http_method: string;
  endpoint_path: string;
  parameters_schema: any;
}

export async function getServerById(serverId: string): Promise<ServerRecord> {
  const { data, error } = await supabaseAdmin
    .from('mcp_servers')
    .select('*')
    .eq('id', serverId)
    .single();

  if (error || !data) {
    throw new Error(`Servidor MCP com ID ${serverId} nao encontrado.`);
  }

  return data as ServerRecord;
}

export async function getCategoriesByServerId(serverId: string): Promise<CategoryRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('mcp_categories')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Falha ao buscar categorias para o servidor ${serverId}.`);
  }

  return (data || []) as CategoryRecord[];
}

export async function getToolsByServerId(serverId: string): Promise<ToolRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('mcp_tools')
    .select('*')
    .eq('server_id', serverId);

  if (error) {
    throw new Error(`Falha ao buscar ferramentas para o servidor ${serverId}.`);
  }

  return (data || []) as ToolRecord[];
}

export async function getFirstServer(): Promise<ServerRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('mcp_servers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as ServerRecord;
}

export async function updateServerCredentials(serverId: string, authType: string, authCredentials: any): Promise<void> {
  const { error } = await supabaseAdmin
    .from('mcp_servers')
    .update({ auth_type: authType, auth_credentials: authCredentials })
    .eq('id', serverId);

  if (error) {
    console.error(`[MCP Repo] Falha ao atualizar credenciais do servidor ${serverId}:`, error.message);
  }
}

export interface SyncReportRecord {
  id: string;
  server_id: string;
  report_summary: string;
  added_endpoints: any[];
  modified_endpoints: any[];
  removed_endpoints: any[];
  created_at: string;
}

export async function getLatestSyncReport(serverId: string): Promise<SyncReportRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('mcp_sync_reports')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as SyncReportRecord;
}

export async function getSyncReports(serverId: string, limit: number = 5): Promise<SyncReportRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('mcp_sync_reports')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Falha ao buscar relatorios de sincronizacao: ${error.message}`);
  }

  return (data || []) as SyncReportRecord[];
}


export async function saveSyncReport(data: { server_id: string; report_summary: string; added_endpoints: any[]; modified_endpoints: any[]; removed_endpoints: any[] }): Promise<SyncReportRecord> {
  const { data: inserted, error } = await supabaseAdmin
    .from('mcp_sync_reports')
    .insert([data])
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(`Falha ao salvar relatorio de sincronizacao: ${error?.message}`);
  }

  return inserted as SyncReportRecord;
}

export async function insertToolsBatch(tools: any[]): Promise<ToolRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('mcp_tools')
    .insert(tools)
    .select();

  if (error) {
    throw new Error(`Falha ao inserir ferramentas em lote: ${error.message}`);
  }

  return (data || []) as ToolRecord[];
}

export async function updateToolSchema(toolId: string, parametersSchema: any): Promise<void> {
  const { error } = await supabaseAdmin
    .from('mcp_tools')
    .update({ parameters_schema: parametersSchema })
    .eq('id', toolId);

  if (error) {
    console.error(`Falha ao atualizar schema da ferramenta ${toolId}:`, error.message);
  }
}

export async function getLatestPlaybook(serverId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('mcp_playbooks')
    .select('content')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.error(`[MCP Repo] Erro ao buscar playbook mais recente para o servidor ${serverId}:`, error.message);
    }
    return null;
  }

  return data.content;
}

export async function savePlaybookVersion(serverId: string, content: string, author = 'ai'): Promise<void> {
  const { error } = await supabaseAdmin
    .from('mcp_playbooks')
    .insert([{ server_id: serverId, content, author }]);

  if (error) {
    console.error(`[MCP Repo] Erro ao salvar versão do playbook para o servidor ${serverId}:`, error.message);
    throw new Error(`Falha ao salvar versão do playbook: ${error.message}`);
  }
}

export async function createCategory(serverId: string, name: string, customPrompt?: string | null): Promise<CategoryRecord> {
  const { data, error } = await supabaseAdmin
    .from('mcp_categories')
    .insert([{ server_id: serverId, name, custom_prompt: customPrompt }])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar categoria: ${error?.message}`);
  }

  return data as CategoryRecord;
}

export async function updateCategory(categoryId: string, updates: { name?: string; custom_prompt?: string | null }): Promise<CategoryRecord> {
  const { data, error } = await supabaseAdmin
    .from('mcp_categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Falha ao atualizar categoria: ${error?.message}`);
  }

  return data as CategoryRecord;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('mcp_categories')
    .delete()
    .eq('id', categoryId);

  if (error) {
    throw new Error(`Falha ao remover categoria: ${error.message}`);
  }
}

export async function updateToolConfig(toolId: string, updates: { custom_name?: string; custom_description?: string; category_id?: string | null; category_ids?: string[]; authRequirement?: any; contentType?: string }): Promise<void> {
  const { data: tool, error: fetchErr } = await supabaseAdmin
    .from('mcp_tools')
    .select('*')
    .eq('id', toolId)
    .single();

  if (fetchErr || !tool) {
    throw new Error(`Ferramenta ${toolId} não encontrada: ${fetchErr?.message}`);
  }

  const updatedSchema = { ...(tool.parameters_schema || {}) };
  if (updates.authRequirement !== undefined) {
    updatedSchema.authRequirement = updates.authRequirement;
  }
  if (updates.contentType !== undefined) {
    updatedSchema.contentType = updates.contentType;
  }

  const dbUpdates: any = {};
  if (updates.custom_name !== undefined) dbUpdates.custom_name = updates.custom_name;
  if (updates.custom_description !== undefined) dbUpdates.custom_description = updates.custom_description;
  if (updates.category_id !== undefined) dbUpdates.category_id = updates.category_id;
  if (updates.category_ids !== undefined) dbUpdates.category_ids = updates.category_ids;
  dbUpdates.parameters_schema = updatedSchema;

  const { error } = await supabaseAdmin
    .from('mcp_tools')
    .update(dbUpdates)
    .eq('id', toolId);

  if (error) {
    throw new Error(`Falha ao atualizar ferramenta ${toolId}: ${error.message}`);
  }
}

export interface TestCaseRecord {
  id: string;
  server_id: string;
  name: string;
  description?: string | null;
  steps: any[];
  variables_schema?: any;
  created_at: string;
  last_run_status?: string | null;
  last_run_at?: string | null;
}

export interface TestRunRecord {
  id: string;
  test_case_id: string;
  executed_at: string;
  status: string;
  duration_ms: number;
  log_details: any;
}

export async function saveTestCase(serverId: string, data: Partial<TestCaseRecord> & { name: string; steps: any[] }): Promise<TestCaseRecord> {
  const { data: existing } = await supabaseAdmin
    .from('mcp_test_cases')
    .select('id')
    .eq('server_id', serverId)
    .eq('name', data.name)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabaseAdmin
      .from('mcp_test_cases')
      .update({
        description: data.description,
        steps: data.steps,
        variables_schema: data.variables_schema || {}
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error(`Falha ao atualizar caso de teste: ${error?.message}`);
    }
    return updated as TestCaseRecord;
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from('mcp_test_cases')
      .insert([{
        server_id: serverId,
        name: data.name,
        description: data.description,
        steps: data.steps,
        variables_schema: data.variables_schema || {}
      }])
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Falha ao criar caso de teste: ${error?.message}`);
    }
    return inserted as TestCaseRecord;
  }
}

export async function deleteTestCase(serverId: string, testCaseIdOrName: string): Promise<void> {
  const query = supabaseAdmin.from('mcp_test_cases').delete().eq('server_id', serverId);
  
  if (testCaseIdOrName.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
    query.eq('id', testCaseIdOrName);
  } else {
    query.eq('name', testCaseIdOrName);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Falha ao deletar caso de teste: ${error.message}`);
  }
}

export async function getTestCases(serverId: string): Promise<TestCaseRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('mcp_test_cases')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao buscar casos de teste: ${error.message}`);
  }

  return (data || []) as TestCaseRecord[];
}

export async function getTestCaseByName(serverId: string, name: string): Promise<TestCaseRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('mcp_test_cases')
    .select('*')
    .eq('server_id', serverId)
    .eq('name', name)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar caso de teste: ${error.message}`);
  }

  return data as TestCaseRecord | null;
}

export async function saveTestRun(testCaseId: string, status: string, durationMs: number, logDetails: any): Promise<TestRunRecord> {
  const { data: inserted, error } = await supabaseAdmin
    .from('mcp_test_runs')
    .insert([{
      test_case_id: testCaseId,
      status,
      duration_ms: durationMs,
      log_details: logDetails
    }])
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(`Falha ao registrar historico de teste: ${error?.message}`);
  }

  await supabaseAdmin
    .from('mcp_test_cases')
    .update({
      last_run_status: status,
      last_run_at: new Date().toISOString()
    })
    .eq('id', testCaseId);

  return inserted as TestRunRecord;
}

export async function getTestRuns(testCaseId: string, limit = 10): Promise<TestRunRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('mcp_test_runs')
    .select('*')
    .eq('test_case_id', testCaseId)
    .order('executed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Falha ao buscar historico de execucao: ${error.message}`);
  }

  return (data || []) as TestRunRecord[];
}

