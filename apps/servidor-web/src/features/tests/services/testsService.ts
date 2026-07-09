import { supabase } from '@/lib/supabase';

export interface TestCaseStep {
  requestId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  queryParams?: any;
  authProfileId?: string;
}

export interface TestCaseEntity {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  steps: TestCaseStep[];
  variables_schema: Record<string, any> | null;
  last_run_status: 'success' | 'failed' | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestRunStepResult {
  requestId: string;
  status: number;
  success: boolean;
  latencyMs: number;
  data: any;
  error: string | null;
}

export interface TestRunEntity {
  id: string;
  test_case_id: string;
  status: 'success' | 'failed';
  duration_ms: number;
  results: TestRunStepResult[];
  created_at: string;
}

export async function fetchTestCasesService(serverId: string): Promise<TestCaseEntity[]> {
  const { data, error } = await supabase
    .from('mcp_test_cases')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Falha ao buscar casos de teste.');
  }

  return (data || []) as TestCaseEntity[];
}

export async function fetchTestRunsService(testCaseId: string): Promise<TestRunEntity[]> {
  const { data, error } = await supabase
    .from('mcp_test_runs')
    .select('*')
    .eq('test_case_id', testCaseId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Falha ao buscar histórico de rodadas.');
  }

  return (data || []) as TestRunEntity[];
}

export async function saveTestCaseService(
  serverId: string,
  testCase: Partial<TestCaseEntity>
): Promise<TestCaseEntity> {
  const payload = {
    server_id: serverId,
    name: testCase.name,
    description: testCase.description || null,
    steps: testCase.steps || [],
    variables_schema: testCase.variables_schema || {}
  };

  let query;
  if (testCase.id) {
    query = supabase
      .from('mcp_test_cases')
      .update(payload)
      .eq('id', testCase.id)
      .select()
      .single();
  } else {
    query = supabase
      .from('mcp_test_cases')
      .insert([payload])
      .select()
      .single();
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Falha ao salvar caso de teste.');
  }

  return data as TestCaseEntity;
}

export async function deleteTestCaseService(testCaseId: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_test_cases')
    .delete()
    .eq('id', testCaseId);

  if (error) {
    throw new Error(error.message || 'Falha ao deletar caso de teste.');
  }
}

export interface TestRunsStats {
  total: number;
  success: number;
  failed: number;
  lastRunAt: string | null;
}

export async function fetchTestRunsStatsByServerService(
  serverId: string,
): Promise<TestRunsStats> {
  const { data: cases, error: casesError } = await supabase
    .from('mcp_test_cases')
    .select('id')
    .eq('server_id', serverId);

  if (casesError) {
    throw new Error(casesError.message || 'Falha ao buscar casos de teste.');
  }

  const caseIds = (cases || []).map((c) => c.id);
  if (caseIds.length === 0) {
    return { total: 0, success: 0, failed: 0, lastRunAt: null };
  }

  const { data: runs, error: runsError } = await supabase
    .from('mcp_test_runs')
    .select('status, created_at')
    .in('test_case_id', caseIds)
    .order('created_at', { ascending: false })
    .limit(100);

  if (runsError) {
    throw new Error(runsError.message || 'Falha ao buscar execuções de teste.');
  }

  const items = runs || [];
  return {
    total: items.length,
    success: items.filter((r) => r.status === 'success').length,
    failed: items.filter((r) => r.status === 'failed').length,
    lastRunAt: items[0]?.created_at ?? null,
  };
}

export async function runTestCaseService(
  serverId: string,
  testCaseId: string,
  variablesOverride?: Record<string, any>
): Promise<{ success: boolean; status: 'success' | 'failed'; durationMs: number; steps: TestRunStepResult[]; testRun: TestRunEntity }> {
  const res = await fetch('/api/run-test-case', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverId, testCaseId, variablesOverride })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao rodar caso de teste.');
  }

  return data;
}
