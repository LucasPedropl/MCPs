-- Drop legacy mcp_playbooks (data migrated to agent_playbooks in 005)

DROP VIEW IF EXISTS public.mcp_playbooks_compat;
DROP TABLE IF EXISTS public.mcp_playbooks;
