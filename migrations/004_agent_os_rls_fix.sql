-- Fix RLS policies for Agent OS tables (003 may have created tables without policies)

ALTER TABLE public.agent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_pitfalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_task_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skill_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_project_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_hub_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_os_preferences_all ON public.agent_preferences;
CREATE POLICY agent_os_preferences_all ON public.agent_preferences
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_decisions_all ON public.agent_decisions;
CREATE POLICY agent_os_decisions_all ON public.agent_decisions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_pitfalls_all ON public.agent_pitfalls;
CREATE POLICY agent_os_pitfalls_all ON public.agent_pitfalls
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_task_log_all ON public.agent_task_log;
CREATE POLICY agent_os_task_log_all ON public.agent_task_log
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_skills_all ON public.agent_skills;
CREATE POLICY agent_os_skills_all ON public.agent_skills
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_skill_bindings_all ON public.agent_skill_bindings;
CREATE POLICY agent_os_skill_bindings_all ON public.agent_skill_bindings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_playbooks_all ON public.agent_playbooks;
CREATE POLICY agent_os_playbooks_all ON public.agent_playbooks
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_project_profiles_all ON public.agent_project_profiles;
CREATE POLICY agent_os_project_profiles_all ON public.agent_project_profiles
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_os_mcp_hub_all ON public.mcp_hub_connections;
CREATE POLICY agent_os_mcp_hub_all ON public.mcp_hub_connections
  FOR ALL USING (true) WITH CHECK (true);
