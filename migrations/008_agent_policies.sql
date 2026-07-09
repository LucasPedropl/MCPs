-- ============================================
-- Agent OS Policy Engine
-- Projeto: MCP Servers (xrjjzyfevbuuxeundgds)
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text NOT NULL,
  action_pattern text NOT NULL,
  rule jsonb NOT NULL DEFAULT '{"effect":"deny"}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_policies_enabled
  ON public.agent_policies (enabled, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_policies_intent
  ON public.agent_policies (intent);

ALTER TABLE public.agent_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_os_policies_all ON public.agent_policies;
CREATE POLICY agent_os_policies_all ON public.agent_policies
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
