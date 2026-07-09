---
name: supabase-workflows
description: Fluxos Supabase com agent-os data module — switch_project, migrations, RLS e execute_sql.
---

# Supabase Workflows

1. `get_active_project` — confirme conta e projectRef
2. `switch_project` se necessário
3. `schema_context_for_task` para contexto mínimo
4. `execute_sql` / `apply_migration` no projeto ativo
5. Validar RLS com queries anon/auth quando aplicável
