-- ============================================
-- Personal Agent OS (@mcps/agent-os)
-- Memória, skills, MCP hub, perfis de projeto
-- Projeto: MCP Servers (xrjjzyfevbuuxeundgds)
-- ============================================

-- agent_preferences
CREATE TABLE IF NOT EXISTS public.agent_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'project')),
  workspace_path text,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_preferences_key_scope_workspace
  ON public.agent_preferences (key, scope, COALESCE(workspace_path, ''));

CREATE INDEX IF NOT EXISTS idx_agent_preferences_scope
  ON public.agent_preferences (scope, priority DESC);

-- agent_decisions
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text,
  topic text NOT NULL,
  problem text,
  chosen_option text NOT NULL,
  rationale text,
  links text[] NOT NULL DEFAULT '{}',
  workspace_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_project_topic
  ON public.agent_decisions (project, topic, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_workspace
  ON public.agent_decisions (workspace_path, created_at DESC);

-- agent_pitfalls
CREATE TABLE IF NOT EXISTS public.agent_pitfalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text,
  symptom text NOT NULL,
  root_cause text,
  fix text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  workspace_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pitfalls_tags
  ON public.agent_pitfalls USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_agent_pitfalls_workspace
  ON public.agent_pitfalls (workspace_path, created_at DESC);

-- agent_task_log
CREATE TABLE IF NOT EXISTS public.agent_task_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL,
  summary text NOT NULL,
  host text,
  provider text,
  outcome text NOT NULL DEFAULT 'unknown',
  artifacts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  workspace_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_task_log_task_id
  ON public.agent_task_log (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_task_log_workspace
  ON public.agent_task_log (workspace_path, created_at DESC);

-- agent_skills
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '1.0.0',
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'project', 'workspace')),
  content_md text NOT NULL DEFAULT '',
  files_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  workspace_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_skills_name_version
  ON public.agent_skills (name, version);

CREATE INDEX IF NOT EXISTS idx_agent_skills_scope
  ON public.agent_skills (scope, name);

-- agent_skill_bindings
CREATE TABLE IF NOT EXISTS public.agent_skill_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.agent_skills(id) ON DELETE CASCADE,
  workspace_glob text,
  project_path text,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_skill_bindings_skill
  ON public.agent_skill_bindings (skill_id);

CREATE INDEX IF NOT EXISTS idx_agent_skill_bindings_project
  ON public.agent_skill_bindings (project_path);

-- agent_playbooks (extends mcp_playbooks concept)
CREATE TABLE IF NOT EXISTS public.agent_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  alias text,
  content_md text NOT NULL,
  author text NOT NULL DEFAULT 'ai',
  version_tag text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_playbooks_server
  ON public.agent_playbooks (server_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_playbooks_alias
  ON public.agent_playbooks (alias, created_at DESC);

-- agent_project_profiles
CREATE TABLE IF NOT EXISTS public.agent_project_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_path text NOT NULL UNIQUE,
  stack_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  bundle_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_project_profiles_updated
  ON public.agent_project_profiles (updated_at DESC);

-- mcp_hub_connections
CREATE TABLE IF NOT EXISTS public.mcp_hub_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL UNIQUE,
  transport text NOT NULL CHECK (transport IN ('stdio', 'http', 'openapi')),
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_cache_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_health_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_hub_connections_status
  ON public.mcp_hub_connections (status, alias);

-- RLS (service role access for personal MCP)
ALTER TABLE public.agent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_pitfalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_task_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skill_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_project_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_hub_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_preferences FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_decisions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_pitfalls FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_task_log FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_skills FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_skill_bindings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_playbooks FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.agent_project_profiles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_access" ON public.mcp_hub_connections FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
