# Personal Agent OS (`@mcps/agent-os`)

MCP unificado para uso pessoal: memória, contexto, orquestração multi-IDE, hub
lazy de MCPs externos, data plane Supabase, skills e quality gates.

Guia de uso para agentes: [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) (árvore de
decisão "Quero X → use Y", limitações e taxonomia de policies). O mesmo
conteúdo é servido via tool `get_usage_guide`.

## Configuração (`mcp.json`)

```json
{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPs/packages/agent-os/dist/index.js"],
      "env": {
        "AGENT_OS_SUPABASE_URL": "https://xrjjzyfevbuuxeundgds.supabase.co",
        "AGENT_OS_SUPABASE_KEY": "<service_role recomendado>",
        "AGENT_OS_DEFAULT_CWD": "C:/codigo/pessoal/seu-projeto",
        "AGENT_OS_MODULES": "all"
      }
    }
  }
}
```

- **`AGENT_OS_SUPABASE_KEY`**: use a **service_role** key. Com anon key,
  escritas em `agent_projects` (bootstrap/upsert de perfil) são bloqueadas por
  RLS e degradam com warning.
- **`AGENT_OS_MODULES`**: csv de módulos para servidores enxutos, ex.
  `memory,context,data,policy`. Ausente ou `all` habilita tudo.

## Fluxo diário

1. `bootstrap_project` — detecta stack e bundle
2. `assemble_context` — contexto mínimo sob budget (regras de projeto chegam aqui)
3. `route_for_pedro` / `delegate_task` / `delegate_async` — execução
4. `list_connected_mcps` → `call_mcp_tool` — GitHub, Vercel, etc.
5. `run_quality_gates` + `summarize_diff` — entrega

## Módulos (~55 tools consolidadas)

| Módulo | Tools |
|--------|-------|
| core | `agent_os_status`, `get_usage_guide` |
| memory | `remember`, `set_project_rule`, `recall_for_task`, `memory_admin`, `import_from_rules` |
| context | `assemble_context` |
| bootstrap | `bootstrap_project` |
| knowledge | `resolve_skills`, `get_skill`, `sync_skills`, `skill_admin`, `playbook` |
| mcp_hub | `list_connected_mcps`, `connect_mcp`, `install_mcp`, `list_mcp_tools`, `get_mcp_tool_schema`, `call_mcp_tool`, `mcp_admin` |
| data | `hub_status`, `list_accounts`, `list_projects`, `switch_project`, `get_active_project`, `call_supabase_tool`, `list_supabase_tools`, `keepalive`, `hub_admin`, `export_mcp_config`, `schema_context_for_task` |
| orchestration | `bridge_status`, `list_models`, `delegate_task`, `delegate_and_wait`, `delegate_async`, `get_job_status`, `list_jobs`, `cancel_job`, `job_admin`, `delegate_parallel`, `route_prompt`, `create_session`, `continue_session`, `session_admin`, `job_observability`, `run_pipeline`, `resume_pipeline`, `get_pipeline_status`, `webhooks`, `route_for_pedro`, `handoff_session`, `resume_task` |
| policy | `upsert_policy`, `check_policy`, `policy_admin` |
| projects | `list_agent_projects`, `get_project`, `upsert_project`, `delete_project`, `sync_project` |
| runner | `run_quality_gates`, `summarize_diff`, `rollback_task`, `run_autofix_loop` |

As 14 proxies Supabase diretas (`list_tables`, `execute_sql`, ...) saíram do
servidor unificado — use `call_supabase_tool` ou o MCP standalone
`supabase-hub` (que continua expondo as proxies).

## Policies com enforcement real (Cursor Hooks)

`upsert_policy`/`set_project_rule` gravam policies deny que são aplicadas:

1. **Automaticamente** nas delegações (`delegate_task`, `delegate_and_wait`,
   `delegate_async`, `delegate_parallel`, `run_pipeline`).
2. **Nos hooks do Cursor** (bloqueio real de edição/shell): copie
   [`docs/agent-os-hooks.json.example`](../../docs/agent-os-hooks.json.example)
   para `~/.cursor/hooks.json` e ajuste o caminho do dist.
   - `sessionStart` → injeta regras/decisões/pitfalls do workspace no contexto
   - `beforeShellExecution` → bloqueia `shell:<cmd>` deny
   - `preToolUse` (Write/Edit/Delete) → bloqueia `write:<glob>` deny

Os hooks resolvem credenciais de `~/.agent-os/hooks-env.json`, do env, ou do
`~/.cursor/mcp.json`. Cache local de policies com TTL 60s em
`~/.agent-os/cache/policies.json`.

Taxonomia de actions: `write:<glob>`, `shell:<cmd>`, `delegate_task:<provider>`,
`delegate_async:<provider>`, `sql:<op>`. Patterns aceitam glob (`**`), regex ou
substring. **Atenção**: `check_policy` é allow-by-default — sem match, retorna
`allowed: true` com `warning`.

## Skills canônicas

Diretório [`../../skills`](../../skills) na raiz do monorepo.

## Migração

Aplique migrações `003`–`011` em [`migrations/`](../../migrations/) no projeto
MCP Servers. A `010` cria `agent_projects`; a `011` restringe escrita a
service_role (leitura pública só de projetos publicados).

## Deprecação

Este pacote substitui `@mcps/communication` e `@mcps/supabase-hub` para uso diário.
