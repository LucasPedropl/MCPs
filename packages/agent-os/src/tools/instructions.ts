/**
 * Instruções canônicas do Agent OS, expostas como server instructions do MCP
 * e via tool get_usage_guide. Espelhadas em packages/agent-os/INSTRUCTIONS.md.
 */
export const AGENT_OS_INSTRUCTIONS = `# Personal Agent OS

Sistema operacional pessoal do Pedro: memória persistente, contexto sob budget,
delegação multi-IDE, hub Supabase multi-conta e hub lazy de MCPs externos.

## Fluxo obrigatório de início de sessão

1. \`bootstrap_project\` ao abrir workspace novo (detecta stack, salva perfil)
2. \`assemble_context\` antes de QUALQUER tarefa complexa — é aqui que regras de
   projeto, decisões e pitfalls chegam até você. Pular este passo = ignorar as
   regras do projeto.
3. Ao finalizar: \`run_quality_gates\` + \`summarize_diff\`

## Árvore de decisão — "Quero X → use Y"

| Quero... | Use |
|----------|-----|
| Definir regra de projeto ("nunca tocar na API") | \`set_project_rule\` (grava preferência + policy deny opcional) |
| Salvar preferência/decisão/pitfall | \`remember\` (param kind) |
| Lembrar o que sei sobre esta tarefa | \`recall_for_task\` ou \`assemble_context\` |
| Bloquear/permitir uma ação | \`upsert_policy\` + \`check_policy\` (deny vale nas delegações e hooks) |
| Delegar tarefa a outra IDE | \`route_for_pedro\` → \`delegate_task\`/\`delegate_async\` (ver get_usage_guide da orquestração) |
| Operar banco Supabase | \`get_active_project\` → \`switch_project\` se preciso → \`call_supabase_tool\` |
| Descobrir schema do banco | \`schema_context_for_task\` ou \`call_supabase_tool\` list_tables |
| Usar GitHub/Vercel/API externa | \`list_connected_mcps\` → \`list_mcp_tools\` → \`call_mcp_tool\` |
| Consultar skill/playbook | \`resolve_skills\` / \`playbook\` (action=get) |
| Ver/editar portfólio de projetos | \`list_agent_projects\` / \`upsert_project\` / \`sync_project\` |
| Validar código ao final | \`run_quality_gates\` → \`run_autofix_loop\` se falhar |

## Limitações conhecidas (leia antes de confiar)

- **Policies são deny-by-exception, allow-by-default**: se nenhum pattern casar,
  \`check_policy\` retorna allowed=true com warning. Para bloqueio real de
  edições/comandos, instale os hooks do Cursor (docs/agent-os-hooks.json.example).
- **check_policy é aplicado automaticamente** nas tools de delegação
  (delegate_task, delegate_and_wait, delegate_async, delegate_parallel,
  run_pipeline). Fora delas, consulte manualmente antes de ações sensíveis.
- **Escrita em agent_projects exige service_role key**; com anon key,
  bootstrap_project degrada com warning (perfil não persiste).

## Módulos (desabilitáveis via env AGENT_OS_MODULES=csv)

- **memory**: remember, set_project_rule, recall_for_task, memory_admin, import_from_rules
- **context**: assemble_context (budget de tokens + snapshot/diff)
- **bootstrap**: bootstrap_project
- **knowledge**: resolve_skills, get_skill, sync_skills, skill_admin, playbook
- **mcp_hub**: hub lazy de MCPs externos (connect, install, call, admin)
- **data**: hub Supabase multi-conta (switch_project, call_supabase_tool, keepalive, hub_admin)
- **orchestration**: delegação multi-IDE (bridge, jobs, sessions, pipeline)
- **policy**: upsert_policy, check_policy, policy_admin
- **projects**: registry/portfólio (agent_projects)
- **runner**: quality gates, autofix, diff, rollback
`;
