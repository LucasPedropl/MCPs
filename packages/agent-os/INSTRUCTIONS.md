# Personal Agent OS — Instruções

> Fonte canônica: `src/tools/instructions.ts` (constante `AGENT_OS_INSTRUCTIONS`,
> exposta como server instructions do MCP e via tool `get_usage_guide`).
> Este arquivo é o espelho humano — mantenha os dois em sincronia.

Sistema operacional pessoal do Pedro: memória persistente, contexto sob budget,
delegação multi-IDE, hub Supabase multi-conta e hub lazy de MCPs externos.

## Fluxo obrigatório de início de sessão

1. `bootstrap_project` ao abrir workspace novo (detecta stack, salva perfil)
2. `assemble_context` antes de QUALQUER tarefa complexa — é aqui que regras de
   projeto, decisões e pitfalls chegam até o agente. Pular este passo = ignorar
   as regras do projeto.
3. Ao finalizar: `run_quality_gates` + `summarize_diff`

## Árvore de decisão — "Quero X → use Y"

| Quero... | Use |
|----------|-----|
| Definir regra de projeto ("nunca tocar na API") | `set_project_rule` (grava preferência + policy deny opcional) |
| Salvar preferência/decisão/pitfall | `remember` (param `kind`) |
| Lembrar o que sei sobre esta tarefa | `recall_for_task` ou `assemble_context` |
| Bloquear/permitir uma ação | `upsert_policy` + `check_policy` (deny vale nas delegações e hooks) |
| Delegar tarefa a outra IDE | `route_for_pedro` → `delegate_task`/`delegate_async` |
| Operar banco Supabase | `get_active_project` → `switch_project` se preciso → `call_supabase_tool` |
| Descobrir schema do banco | `schema_context_for_task` ou `call_supabase_tool` list_tables |
| Usar GitHub/Vercel/API externa | `list_connected_mcps` → `list_mcp_tools` → `call_mcp_tool` |
| Consultar skill/playbook | `resolve_skills` / `playbook` (action=get) |
| Ver/editar portfólio de projetos | `list_agent_projects` / `upsert_project` / `sync_project` |
| Validar código ao final | `run_quality_gates` → `run_autofix_loop` se falhar |

## Limitações conhecidas

- **Policies são allow-by-default**: se nenhum pattern casar, `check_policy`
  retorna `allowed: true` com `warning`. Para bloqueio real de edições/comandos,
  instale os hooks do Cursor (`docs/agent-os-hooks.json.example`).
- **check_policy é aplicado automaticamente** nas tools de delegação
  (`delegate_task`, `delegate_and_wait`, `delegate_async`, `delegate_parallel`,
  `run_pipeline`). Fora delas, consulte manualmente antes de ações sensíveis.
- **Escrita em `agent_projects` exige service_role key**; com anon key,
  `bootstrap_project` degrada com warning (perfil não persiste).

## Taxonomia de actions (policies)

| Prefixo | Exemplo | Onde é avaliado |
|---------|---------|-----------------|
| `write:<glob>` | `write:apps/pagweb/api/**` | hooks do Cursor (edição de arquivo) |
| `shell:<cmd>` | `shell:rm*` | hooks do Cursor (beforeShellExecution) |
| `delegate_task:<provider>` | `delegate_task:cursor` | tools de delegação |
| `delegate_async:<provider>` | `delegate_async:*` | delegate_async |
| `sql:<op>` | `sql:drop*` | consulta manual via check_policy |

Patterns aceitam glob (`**`), regex ou substring — glob tem precedência quando
o pattern contém `*` sem sintaxe regex.

## Módulos (desabilitáveis via env `AGENT_OS_MODULES=csv`)

| Módulo | Tools principais |
|--------|------------------|
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

Ex.: `AGENT_OS_MODULES=memory,context,data,policy` sobe um servidor enxuto só
com memória + banco. Core (`agent_os_status`, `get_usage_guide`) sempre ativo.

## Nota sobre Supabase

As 14 tools proxy diretas (`list_tables`, `execute_sql`, ...) foram removidas do
servidor unificado — use `call_supabase_tool` (ou o MCP standalone
`supabase-hub`, que continua expondo as proxies diretas).
