-- ============================================
-- Agent OS Context Snapshots
-- Projeto: MCP Servers (xrjjzyfevbuuxeundgds)
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_path text NOT NULL,
  snapshot_hash text NOT NULL,
  bundle_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_context_snapshots_workspace
  ON public.agent_context_snapshots (workspace_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_context_snapshots_hash
  ON public.agent_context_snapshots (workspace_path, snapshot_hash);

ALTER TABLE public.agent_context_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_os_context_snapshots_all ON public.agent_context_snapshots;
CREATE POLICY agent_os_context_snapshots_all ON public.agent_context_snapshots
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
