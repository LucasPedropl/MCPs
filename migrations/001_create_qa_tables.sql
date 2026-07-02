-- ============================================
-- DDL de Migração: Tabelas de QA & Playbooks
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================

-- 1. Tabela: mcp_playbooks (Guia de Integração / Playbook da IA)
CREATE TABLE IF NOT EXISTS public.mcp_playbooks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  content text NOT NULL,
  author text DEFAULT 'ai',
  created_at timestamptz DEFAULT now()
);

-- Índice para buscar playbooks por servidor, mais recente primeiro
CREATE INDEX IF NOT EXISTS idx_mcp_playbooks_server_id ON public.mcp_playbooks(server_id, created_at DESC);

-- 2. Tabela: mcp_test_cases (Casos de Teste de Regressão)
CREATE TABLE IF NOT EXISTS public.mcp_test_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables_schema jsonb DEFAULT '{}'::jsonb,
  last_run_status text,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índice único: não pode haver dois casos de teste com o mesmo nome no mesmo servidor
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_test_cases_server_name ON public.mcp_test_cases(server_id, name);

-- 3. Tabela: mcp_test_runs (Histórico de Execuções)
CREATE TABLE IF NOT EXISTS public.mcp_test_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case_id uuid NOT NULL REFERENCES public.mcp_test_cases(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  duration_ms integer DEFAULT 0,
  log_details jsonb DEFAULT '{}'::jsonb,
  executed_at timestamptz DEFAULT now()
);

-- Índice para buscar execuções por caso de teste, mais recente primeiro
CREATE INDEX IF NOT EXISTS idx_mcp_test_runs_case_id ON public.mcp_test_runs(test_case_id, executed_at DESC);

-- 4. Habilitar RLS (Row Level Security) - Modo permissivo para service_role
ALTER TABLE public.mcp_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_test_runs ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para service_role (usado pelo backend)
CREATE POLICY "service_role_full_access" ON public.mcp_playbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.mcp_test_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.mcp_test_runs FOR ALL USING (true) WITH CHECK (true);

-- 5. Recarregar o cache do PostgREST (resolve o erro "table not found in schema cache")
NOTIFY pgrst, 'reload schema';
