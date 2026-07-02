-- ============================================
-- Bridge / Communication MCP (@mcps/communication)
-- Centralizado no projeto MCP Servers
-- Migrado de MCP-Bright (enqpcrvqmzuyzglgwnrk)
-- ============================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.bridge_provider AS ENUM (
    'antigravity', 'cursor', 'copilot', 'parallel', 'pipeline'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- delegation_jobs
CREATE TABLE IF NOT EXISTS public.delegation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL,
  provider public.bridge_provider NOT NULL,
  model text,
  prompt text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  mode text NOT NULL DEFAULT 'subagent',
  agentic_mode boolean NOT NULL DEFAULT false,
  timeout_ms integer NOT NULL DEFAULT 120000,
  response text,
  error text,
  session_id text,
  cascade_id text,
  exit_code integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  parent_job_id uuid REFERENCES public.delegation_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_delegation_jobs_status ON public.delegation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_delegation_jobs_created ON public.delegation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delegation_jobs_parent ON public.delegation_jobs(parent_job_id);
CREATE INDEX IF NOT EXISTS idx_delegation_jobs_workspace_created
  ON public.delegation_jobs(workspace, created_at DESC);

-- delegation_sessions
CREATE TABLE IF NOT EXISTS public.delegation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL,
  title text,
  provider public.bridge_provider NOT NULL,
  external_session_id text,
  model text,
  last_prompt text,
  last_response text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delegation_sessions_workspace
  ON public.delegation_sessions(workspace);

-- shared_context
CREATE TABLE IF NOT EXISTS public.shared_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.delegation_sessions(id),
  workspace text NOT NULL,
  label text,
  content text NOT NULL,
  content_type text NOT NULL DEFAULT 'text',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_context_session ON public.shared_context(session_id);
CREATE INDEX IF NOT EXISTS idx_shared_context_workspace ON public.shared_context(workspace);

-- job_events
CREATE TABLE IF NOT EXISTS public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.delegation_jobs(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id_created
  ON public.job_events(job_id, created_at DESC);

-- provider_health_snapshots
CREATE TABLE IF NOT EXISTS public.provider_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT '',
  provider public.bridge_provider NOT NULL,
  status text NOT NULL,
  latency_ms integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_provider
  ON public.provider_health_snapshots(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_workspace
  ON public.provider_health_snapshots(workspace, created_at DESC);

-- workspace_locks
CREATE TABLE IF NOT EXISTS public.workspace_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL,
  holder_id text NOT NULL,
  lock_type text NOT NULL DEFAULT 'exclusive',
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT workspace_locks_lock_type_check
    CHECK (lock_type = ANY (ARRAY['exclusive'::text, 'shared'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_locks_exclusive
  ON public.workspace_locks(workspace) WHERE (lock_type = 'exclusive');
CREATE INDEX IF NOT EXISTS idx_workspace_locks_expires
  ON public.workspace_locks(expires_at);

-- RLS (mesmo padrão permissivo do MCP-Bright — uso local/pessoal)
ALTER TABLE public.delegation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delegation_jobs_bridge_access ON public.delegation_jobs;
CREATE POLICY delegation_jobs_bridge_access ON public.delegation_jobs
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS job_events_bridge_access ON public.job_events;
CREATE POLICY job_events_bridge_access ON public.job_events
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_delegation_sessions ON public.delegation_sessions;
CREATE POLICY allow_all_delegation_sessions ON public.delegation_sessions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_shared_context ON public.shared_context;
CREATE POLICY allow_all_shared_context ON public.shared_context
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_health_snapshots ON public.provider_health_snapshots;
CREATE POLICY allow_all_health_snapshots ON public.provider_health_snapshots
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS workspace_locks_all ON public.workspace_locks;
CREATE POLICY workspace_locks_all ON public.workspace_locks
  FOR ALL USING (true) WITH CHECK (true);

-- Realtime (worker do bridge escuta INSERT em delegation_jobs)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delegation_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
