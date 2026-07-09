---
name: portfolio-workflows
description: Fluxos para cadastrar e publicar projetos pessoais via Agent OS (upsert_project, sync GitHub/Vercel).
---

# Portfolio Workflows

Use o registry unificado `agent_projects` no Supabase via MCP agent-os.

## Fluxo padrão

1. `upsert_project` — título, descrição, tags, type, workspace_path, github_url
2. `sync_project_from_github` — README → `docs_md`
3. `sync_project_from_vercel` — deploy URL
4. `upload_project_cover` — capa (opcional)
5. `upsert_project` com `status: "published"` e `featured: true`

## Antes de sync externo

- Conectar presets: `register_preset_mcps` ou hub UI em `/agent-os/hub`
- GitHub: `GITHUB_PERSONAL_ACCESS_TOKEN`
- Vercel: `VERCEL_TOKEN`

## Consulta

- `list_agent_projects` — todos os registros
- `get_project` — por slug ou id
- `assemble_project_docs` — preview markdown completo

## Portfólio público

O site `personal-portfolio` lê `agent_projects` onde `status=published` e `portfolio_visible=true`.
Credenciais anon estão em `src/lib/supabase-config.ts` (leitura pública via RLS — sem `.env`).
CRUD apenas pelo Agent OS (dashboard ou MCP).
