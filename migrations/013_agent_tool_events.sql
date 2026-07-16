-- 013: Telemetria de uso das tools do Agent OS
-- Eventos de tools/call (sem args/results — só dimensões seguras).

CREATE TABLE IF NOT EXISTS public.agent_tool_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  host text NOT NULL DEFAULT 'unknown'
    CHECK (host IN ('cursor', 'antigravity', 'claude_code', 'unknown')),
  ok boolean NOT NULL,
  duration_ms integer,
  module text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_events_created_at
  ON public.agent_tool_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tool_events_tool_created
  ON public.agent_tool_events (tool_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tool_events_host_created
  ON public.agent_tool_events (host, created_at DESC);

ALTER TABLE public.agent_tool_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_os_tool_events_all ON public.agent_tool_events;
CREATE POLICY agent_os_tool_events_all ON public.agent_tool_events
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.agent_tool_events IS
  'Telemetria de tools/call do agent-os. meta só dimensões seguras (alias, child_tool). Sem args/results.';
