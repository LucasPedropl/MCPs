export type ProjectType = 'frontend' | 'backend' | 'fullstack';
export type ProjectStatus = 'draft' | 'published' | 'archived';

export interface AgentProject {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  tags: string[];
  type: ProjectType;
  featured: boolean;
  cover_image_url: string | null;
  github_url: string | null;
  deploy_url: string | null;
  workspace_path: string | null;
  stack_json: Record<string, unknown>;
  bundle_json: Record<string, unknown>;
  docs_md: string;
  readme_synced_at: string | null;
  github_owner: string | null;
  github_repo: string | null;
  vercel_project_id: string | null;
  vercel_team_slug: string | null;
  status: ProjectStatus;
  portfolio_visible: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectFormState {
  slug: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  tags: string;
  type: ProjectType;
  featured: boolean;
  cover_image_url: string;
  github_url: string;
  deploy_url: string;
  workspace_path: string;
  docs_md: string;
  github_owner: string;
  github_repo: string;
  vercel_project_id: string;
  status: ProjectStatus;
  portfolio_visible: boolean;
}

export function projectToForm(project: AgentProject): ProjectFormState {
  return {
    slug: project.slug,
    title: project.title,
    title_en: project.title_en ?? '',
    description: project.description,
    description_en: project.description_en ?? '',
    tags: project.tags.join(', '),
    type: project.type,
    featured: project.featured,
    cover_image_url: project.cover_image_url ?? '',
    github_url: project.github_url ?? '',
    deploy_url: project.deploy_url ?? '',
    workspace_path: project.workspace_path ?? '',
    docs_md: project.docs_md,
    github_owner: project.github_owner ?? '',
    github_repo: project.github_repo ?? '',
    vercel_project_id: project.vercel_project_id ?? '',
    status: project.status,
    portfolio_visible: project.portfolio_visible,
  };
}

export function formToPayload(form: ProjectFormState): Record<string, unknown> {
  return {
    slug: form.slug || undefined,
    title: form.title,
    title_en: form.title_en || null,
    description: form.description,
    description_en: form.description_en || null,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    type: form.type,
    featured: form.featured,
    cover_image_url: form.cover_image_url || null,
    github_url: form.github_url || null,
    deploy_url: form.deploy_url || null,
    workspace_path: form.workspace_path || null,
    docs_md: form.docs_md,
    github_owner: form.github_owner || null,
    github_repo: form.github_repo || null,
    vercel_project_id: form.vercel_project_id || null,
    status: form.status,
    portfolio_visible: form.portfolio_visible,
  };
}

export const EMPTY_PROJECT_FORM: ProjectFormState = {
  slug: '',
  title: '',
  title_en: '',
  description: '',
  description_en: '',
  tags: '',
  type: 'fullstack',
  featured: false,
  cover_image_url: '',
  github_url: '',
  deploy_url: '',
  workspace_path: '',
  docs_md: '',
  github_owner: '',
  github_repo: '',
  vercel_project_id: '',
  status: 'draft',
  portfolio_visible: true,
};
