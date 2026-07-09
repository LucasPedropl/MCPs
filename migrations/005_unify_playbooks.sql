-- Unify mcp_playbooks → agent_playbooks (canonical table)

INSERT INTO public.agent_playbooks (server_id, alias, content_md, author, version_tag, created_at)
SELECT
  mp.server_id,
  'server-' || LEFT(mp.server_id::text, 8),
  mp.content,
  COALESCE(mp.author, 'ai'),
  '1.0.0',
  mp.created_at
FROM public.mcp_playbooks mp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.agent_playbooks ap
  WHERE ap.server_id = mp.server_id
    AND ap.content_md = mp.content
    AND ap.created_at = mp.created_at
);

-- Compatibility view (read-only)
CREATE OR REPLACE VIEW public.mcp_playbooks_compat AS
SELECT
  id,
  server_id,
  content_md AS content,
  author,
  created_at
FROM public.agent_playbooks
WHERE server_id IS NOT NULL;
