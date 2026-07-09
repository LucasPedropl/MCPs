-- Corrige RLS de agent_projects e project-covers: leitura pública restrita apenas.
-- service_role (Agent OS) bypassa RLS; policies "FOR ALL USING (true)" abriam CRUD para anon.

DROP POLICY IF EXISTS agent_os_projects_all ON public.agent_projects;

DROP POLICY IF EXISTS agent_projects_public_read ON public.agent_projects;
CREATE POLICY agent_projects_public_read ON public.agent_projects
  FOR SELECT
  TO anon, authenticated
  USING (portfolio_visible = true AND status = 'published');

DROP POLICY IF EXISTS project_covers_service_all ON storage.objects;

DROP POLICY IF EXISTS project_covers_public_read ON storage.objects;
CREATE POLICY project_covers_public_read ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'project-covers');

NOTIFY pgrst, 'reload schema';
