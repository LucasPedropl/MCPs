-- Projects Registry: unifica agent_project_profiles + campos de portfólio
-- Projeto: MCP Servers (xrjjzyfevbuuxeundgds)

CREATE TABLE IF NOT EXISTS public.agent_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  title_en text,
  description text NOT NULL DEFAULT '',
  description_en text,
  tags text[] NOT NULL DEFAULT '{}',
  type text NOT NULL DEFAULT 'fullstack' CHECK (type IN ('frontend', 'backend', 'fullstack')),
  featured boolean NOT NULL DEFAULT false,
  cover_image_url text,
  github_url text,
  deploy_url text,
  workspace_path text UNIQUE,
  stack_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  bundle_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  docs_md text NOT NULL DEFAULT '',
  readme_synced_at timestamptz,
  github_owner text,
  github_repo text,
  vercel_project_id text,
  vercel_team_slug text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  portfolio_visible boolean NOT NULL DEFAULT true,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_projects_status ON public.agent_projects (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_projects_featured ON public.agent_projects (featured, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_projects_portfolio ON public.agent_projects (portfolio_visible, status);

-- Migrar dados de agent_project_profiles
INSERT INTO public.agent_projects (
  workspace_path,
  stack_json,
  bundle_json,
  updated_at,
  slug,
  title,
  status
)
SELECT
  p.workspace_path,
  p.stack_json,
  p.bundle_json,
  p.updated_at,
  regexp_replace(
    regexp_replace(lower(regexp_replace(p.workspace_path, '\\', '/', 'g')), '[^a-z0-9]+', '-', 'g'),
    '(^-|-$)',
    '',
    'g'
  ) || '-' || substr(md5(p.workspace_path), 1, 6),
  COALESCE(
    NULLIF(regexp_replace(p.workspace_path, '.*[/\\]', ''), ''),
    'project'
  ),
  'draft'
FROM public.agent_project_profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_projects ap WHERE ap.workspace_path = p.workspace_path
);

CREATE OR REPLACE FUNCTION public.set_agent_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_projects_updated_at ON public.agent_projects;
CREATE TRIGGER trg_agent_projects_updated_at
  BEFORE UPDATE ON public.agent_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_agent_projects_updated_at();

ALTER TABLE public.agent_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_projects_public_read ON public.agent_projects;
CREATE POLICY agent_projects_public_read ON public.agent_projects
  FOR SELECT
  TO anon, authenticated
  USING (portfolio_visible = true AND status = 'published');

-- Storage bucket para capas de projetos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-covers',
  'project-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS project_covers_public_read ON storage.objects;
CREATE POLICY project_covers_public_read ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'project-covers');

DROP TABLE IF EXISTS public.agent_project_profiles;

NOTIFY pgrst, 'reload schema';
