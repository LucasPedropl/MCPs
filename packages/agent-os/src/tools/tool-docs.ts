/**
 * Documentação central das tools do Agent OS (módulos não-orchestration).
 * Formato padrão: resumo em 1 linha + WHEN TO USE / WHEN NOT / RETURNS / NOTES.
 * Orchestration mantém docs próprias em modules/orchestration/tools/tool-docs.ts.
 *
 * Em modo compact (default, env AGENT_OS_TOOL_DOCS) o cliente recebe só
 * resumo+RETURNS; doc completa fica sob demanda via get_usage_guide tool_name=...
 */
import { compactToolDoc } from "@mcps/shared";
import { getToolDocsMode } from "../config/env.js";
import { TOOL_DESCRIPTIONS as ORCHESTRATION_TOOL_DOCS } from "../modules/orchestration/tools/tool-docs.js";

export function describeAgentTool(name: string, fallback?: string): string {
	const full = AGENT_TOOL_DOCS[name];
	if (!full) {
		return fallback ?? name;
	}
	if (getToolDocsMode() === "full") {
		return full;
	}
	return COMPACT_TOOL_DOC_OVERRIDES[name] ?? compactToolDoc(full);
}

/** Doc completa (WHEN TO USE/WHEN NOT/RETURNS/PARAMS/NOTES) para lookup sob demanda. */
export function getFullToolDoc(name: string): string | null {
	return AGENT_TOOL_DOCS[name] ?? ORCHESTRATION_TOOL_DOCS[name] ?? null;
}

/** Catálogo estático de tools documentadas (fallback never-used no frontend). */
export function listDocumentedToolNames(): string[] {
	return [
		...new Set([
			...Object.keys(AGENT_TOOL_DOCS),
			...Object.keys(ORCHESTRATION_TOOL_DOCS),
		]),
	].sort((a, b) => a.localeCompare(b));
}

export interface ToolDocEntry {
	summary: string;
	full: string;
}

/** Mapa name → docs para UI (painel usage / modal). Independente de AGENT_OS_TOOL_DOCS. */
export function getToolDocsMap(): Record<string, ToolDocEntry> {
	const out: Record<string, ToolDocEntry> = {};
	for (const name of listDocumentedToolNames()) {
		const full = getFullToolDoc(name) ?? name;
		const summary =
			COMPACT_TOOL_DOC_OVERRIDES[name] ?? compactToolDoc(full);
		out[name] = { summary, full };
	}
	return out;
}

/**
 * Overrides compactos escritos à mão para pares confundíveis: o contraste do
 * WHEN NOT migra para a linha-resumo para não perder precisão de ativação.
 */
export const COMPACT_TOOL_DOC_OVERRIDES: Record<string, string> = {
	call_supabase_tool: `Chama qualquer tool do MCP Supabase oficial no projeto ativo (execute_sql, list_tables, apply_migration, get_logs...). Para MCPs externos do hub (GitHub/Vercel/OpenAPI) use call_mcp_tool. Exige switch_project antes.
RETURNS: Resultado do MCP oficial Supabase (cap de chars com marcador TRUNCATED; max_chars ajusta).`,

	call_mcp_tool: `Executa tool de MCP externo registrado no hub lazy (GitHub, Vercel, OpenAPI custom) por alias. Para o banco Supabase do projeto ativo use call_supabase_tool.
RETURNS: Resultado da tool filha (cap de chars com marcador TRUNCATED; max_chars ajusta).`,

	mcp_usage_stats: `Relatório de uso das tools do agent-os (top, never-used, por host, error rate, proxies). Para painel visual use /agent-os/usage no servidor-web.
RETURNS: { success, summary, top_tools, never_used, proxies, window }`,

	remember: `Salva memória persistente: kind=preference|decision|pitfall|task_log. Para regra de projeto com enforcement use set_project_rule.
RETURNS: Registro salvo com id.`,

	set_project_rule: `Define regra de projeto em UMA chamada: preferência project-scoped + policy deny opcional (enforce=true). Para preferência/decisão/pitfall solto use remember.
RETURNS: { preference, policy?, applied_via }`,

	recall_for_task: `Recupera memória relevante (preferências + decisões + pitfalls) rankeada pela intenção. Para o pacote completo com skills e budget de tokens use assemble_context.
RETURNS: { preferences[], decisions[], pitfalls[] } slim por padrão; raw=true para rows completas.`,

	assemble_context: `Monta pacote mínimo de contexto (regras, decisões, pitfalls, skills, bundle) sob budget de tokens — início de QUALQUER tarefa complexa. Para consulta rápida só de memória use recall_for_task.
RETURNS: { preferences, decisions, pitfalls, skills, playbooks, suggested_tools, suggested_provider, token_estimate, snapshot, diff }`,

	resolve_skills: `Resolve skills relevantes para uma intenção (ranking por score; score 0 fica de fora). Para conteúdo completo de skill conhecida use get_skill.
RETURNS: { skills: [{name, description, version, scope, score}], hint } — sem content_md por default (include_content=true para completo).`,

	get_skill: `Retorna skill completa (content_md + manifesto de sidecars) por nome exato. Para descobrir skill por intenção use resolve_skills.
RETURNS: SkillRecord | null (files_json completo só com include_files=true)`,

	list_projects: `Lista projetos Supabase em cache do hub — descobrir projectRef antes de switch_project. Para o portfólio agent_projects use list_agent_projects.
RETURNS: { count, projects[] }`,

	list_agent_projects: `Lista projetos do registry agent_projects (portfólio + perfis de workspace). Para projetos Supabase do hub use list_projects.
RETURNS: Projetos com slug, título, workspace_path, stack, status.`,

	hub_status: `Visão geral do hub Supabase: contas, projetos, contexto ativo, keep-alive, scheduler. Para status do Agent OS em si use agent_os_status.
RETURNS: { accounts, projects, activeContext, keepAlive, scheduler }`,

	agent_os_status: `Status geral do Agent OS: versão, workspace, Supabase, módulos, tool docs mode. Para o hub Supabase (contas/projetos) use hub_status.
RETURNS: { name, version, configDir, enabledModules, supabase, workspace, toolDocsMode, mcpResultMaxChars, hiddenTools }`,

	connect_mcp: `Registra conexão MCP nova (stdio/http/openapi) com config custom manual. Para presets comuns ou servidores do registry use install_mcp.
RETURNS: Conexão registrada.`,

	install_mcp: `Instalação/registro em lote de MCPs no hub: mode=presets|registry_all|openapi_new|openapi_sync. Para conexão manual custom use connect_mcp.
RETURNS: Relatório de instalação/sync com alias de uso.`,

	switch_project: `Alterna conta/projeto Supabase ativo. OBRIGATÓRIO antes de operar o banco. Confirme com get_active_project.
RETURNS: { success, activeContext }`,
};

export const AGENT_TOOL_DOCS: Record<string, string> = {
	// ── core ────────────────────────────────────────────────────────────────
	mcp_usage_stats: `
Relatório agregado de telemetria das tools do agent-os (calls, erros, never-used, por host).
WHEN TO USE: Descobrir tools mortas, top usage, error rate ou breakdown cursor/antigravity/claude_code no chat.
WHEN NOT: Exploração visual longa — use o painel /agent-os/usage no servidor-web.
RETURNS: { success, summary{total_calls,error_rate,coverage,by_host}, top_tools[], never_used[], proxies[], window }
PARAMS: days? (default 30), host? (cursor|antigravity|claude_code|unknown), limit? (default 20)
NOTES: Exige Supabase. Host só é confiável se AGENT_OS_HOST estiver setado em cada mcp.json. Esta tool não se auto-grava (anti feedback loop). Sem args/results nos eventos.
`.trim(),

	agent_os_status: `
Status geral do Agent OS: versão, workspace, Supabase, módulos habilitados.
WHEN TO USE: Health check rápido ou debug de configuração (key, config dir, workspace resolution).
WHEN NOT: Para guia de uso (use get_usage_guide) ou status do hub Supabase (use hub_status).
RETURNS: { name, version, configDir, enabledModules, supabase: { configured, reachable, keyRole }, workspace }
`.trim(),

	get_usage_guide: `
Guia dinâmico do Agent OS: árvore de decisão "quero X → use Y", fluxo recomendado e status.
WHEN TO USE: PRIMEIRA chamada em qualquer sessão nova ou quando não souber qual tool usar.
WHEN NOT: Quando você já conhece o fluxo e só precisa de status (use agent_os_status).
RETURNS: Markdown com decision tree, fluxo de sessão, limitações conhecidas e status atual.
`.trim(),

	// ── memory ──────────────────────────────────────────────────────────────
	remember: `
Salva memória persistente: preferência, decisão arquitetural ou pitfall (erro recorrente).
WHEN TO USE: kind=preference para regras/configs (upsert por key+scope); kind=decision para escolhas arquiteturais permanentes; kind=pitfall para erros e como evitá-los; kind=task_log para registrar resultado de tarefa.
WHEN NOT: Para regra de projeto com enforcement (use set_project_rule). Para consultar memória (use recall_for_task).
RETURNS: Registro salvo com id.
PARAMS: kind(preference|decision|pitfall|task_log) + campos específicos do kind (ver schema).
NOTES: Requer Supabase configurado. scope=project exige workspace_path.
`.trim(),

	set_project_rule: `
Define regra de projeto em UMA chamada: grava preferência project-scoped e, se enforce=true, cria policy deny.
WHEN TO USE: "Nunca tocar na API", "somente leitura em X", convenções obrigatórias do workspace. É o caminho recomendado para regras de agente por projeto.
WHEN NOT: Preferência global (use remember kind=preference scope=global).
RETURNS: { preference, policy?, applied_via } explicando onde a regra foi gravada e como será aplicada.
PARAMS: workspace_path, rule (texto da regra), key?, priority?, enforce?, action_pattern? (ex: "write:apps/meu-app/api/**").
NOTES: A regra aparece no assemble_context do workspace. Com enforce=true + action_pattern, check_policy e os hooks do Cursor bloqueiam a ação. Sem hook instalado, o bloqueio depende do agente consultar check_policy.
`.trim(),

	recall_for_task: `
Recupera memória relevante (preferências + decisões + pitfalls) rankeada pela intenção.
WHEN TO USE: Antes de tarefas em workspace conhecido, para lembrar regras e erros passados.
WHEN NOT: Para pacote completo com skills e budget (use assemble_context).
RETURNS: { preferences[], decisions[], pitfalls[] } formato slim por padrão (sem ids/timestamps). Use raw=true para rows completas.
`.trim(),

	memory_admin: `
Administração da memória: listar, atualizar, deletar e auditar mudanças.
WHEN TO USE: action=list para inspecionar; action=update para corrigir decisão; action=delete para esquecer; action=changes_since para auditar o que mudou desde data/task.
WHEN NOT: Para salvar memória nova (use remember ou set_project_rule).
RETURNS: Lista de registros, registro atualizado ou { ok: true }.
PARAMS: action(list|update|delete|changes_since), kind(preference|decision|pitfall), id?, filtros.
`.trim(),

	import_from_rules: `
Importa .cursor/rules e skills do workspace como preferências project-scoped.
WHEN TO USE: Onboarding de projeto existente com regras Cursor já escritas.
WHEN NOT: Para regra única (use set_project_rule); para regra que vale em todos os
projetos do Pedro, registre como skill em skills/ e rode sync_skills em vez de preferência global.
RETURNS: { imported: { count, keys[] }, truncated_files?, hint? }
PARAMS: workspace_path.
`.trim(),

	// ── bootstrap / context ─────────────────────────────────────────────────
	bootstrap_project: `
Detecta stack do workspace (Next/React/Supabase/etc), monta bundle recomendado e salva perfil.
WHEN TO USE: Ao abrir workspace pela primeira vez ou após mudanças grandes de stack.
WHEN NOT: Para só ler o contexto já montado (use assemble_context).
RETURNS: { workspace_path, stack_json, bundle_json, detected, warnings? }
NOTES: Persistir o perfil em agent_projects exige service_role key; com anon key retorna warning e continua com o perfil local.
`.trim(),

	assemble_context: `
Monta pacote mínimo de contexto (regras, decisões, pitfalls, skills, bundle) sob budget de tokens.
WHEN TO USE: Início de QUALQUER tarefa complexa — é aqui que regras de projeto (set_project_rule) chegam ao agente. Também retorna diff vs snapshot anterior.
WHEN NOT: Para gravar memória (use remember/set_project_rule).
RETURNS: { preferences, decisions, pitfalls, skills, playbooks, suggested_tools, suggested_provider, token_estimate, snapshot, diff }
PARAMS: intent, workspace_path, host?, token_budget?(default 8000), use_cache?
`.trim(),

	// ── knowledge ───────────────────────────────────────────────────────────
	resolve_skills: `
Resolve skills relevantes para uma intenção (ranking por overlap de tokens; score 0 fica de fora).
WHEN TO USE: Descobrir qual skill seguir antes de uma tarefa específica.
WHEN NOT: Para conteúdo completo de skill conhecida (use get_skill).
RETURNS: { skills: [{name, description, version, scope, score}], hint }. include_content=true devolve content_md completo.
PARAMS: intent, workspace_path?, limit?, include_content?, min_score? (default 1; 0 restaura comportamento antigo).
`.trim(),

	get_skill: `
Retorna skill completa por nome (e versão opcional).
WHEN TO USE: Quando souber o nome exato da skill.
WHEN NOT: Para buscar por intenção (use resolve_skills).
RETURNS: SkillRecord | null. Default: content_md + files_manifest (path/encoding/size). include_files=true traz files_json completo (scripts/references/assets).
NOTES: Sidecars em disco só aparecem após sync_skills direction=to_host (.cursor/skills e .claude/skills). get_skill sozinho não materializa arquivos.
`.trim(),

	sync_skills: `
Sincroniza skills entre repositório, Supabase e workspaces — incluindo sidecars (scripts/, references/, assets/) via files_json.
WHEN TO USE: direction=from_repo para subir skills/ do monorepo ao registry; direction=to_host para materializar SKILL.md + sidecars em .cursor/skills/ e .claude/skills/.
WHEN NOT: Para editar uma skill (use skill_admin action=upsert).
RETURNS: from_repo → { synced, names, warnings[], skillsRoot }; to_host → { written[], hosts[] }.
PARAMS: direction(from_repo|to_host), skills_root? (from_repo), workspace_path (to_host).
NOTES: Arquivos >100KB ou total >500KB geram warning e são skipados. Caps: 40 arquivos/skill.
`.trim(),

	skill_admin: `
Administração do registry de skills: listar, criar/atualizar, deletar, vincular a projeto.
WHEN TO USE: action=list|upsert|delete|bind_to_project.
WHEN NOT: Para resolver skills por intenção (use resolve_skills).
RETURNS: Lista slim (name/description/content_chars/files_count/files_manifest); include_content=true traz content_md; include_files=true inclui files_json.
PARAMS: upsert aceita files_json opcional (mapa path → {encoding, content, size}).
`.trim(),

	playbook: `
CRUD unificado de playbooks versionados por alias.
WHEN TO USE: action=get para consultar o mais recente; action=list; action=update para nova versão; action=delete; action=detect_drift para comparar playbook vs resumo OpenAPI atual.
WHEN NOT: Para skills (use skill_admin).
RETURNS: Conteúdo do playbook, lista, { ok } ou relatório de drift.
PARAMS: action(get|list|update|delete|detect_drift), alias?, content_md?, id?, include_history? (list)
`.trim(),

	// ── mcp_hub ─────────────────────────────────────────────────────────────
	list_connected_mcps: `
Lista MCPs registrados no hub lazy (GitHub, Vercel, OpenAPI custom, etc).
WHEN TO USE: Descobrir aliases disponíveis antes de call_mcp_tool.
WHEN NOT: Para tools de um MCP específico (use list_mcp_tools).
RETURNS: { total, connected: [{id, alias, transport, status, toolCount, last_health_at}], disconnected: [alias...], hint }
PARAMS: include_tool_names? (cap 25), include_disconnected? (objetos completos), include_config?, include_tool_cache?
`.trim(),

	connect_mcp: `
Registra conexão MCP nova (stdio/http/openapi) no hub lazy.
WHEN TO USE: Adicionar MCP externo manualmente com config custom.
WHEN NOT: Para presets comuns ou servidores do registry (use install_mcp).
RETURNS: Conexão registrada.
`.trim(),

	install_mcp: `
Instalação/registro em lote de MCPs no hub.
WHEN TO USE: mode=presets registra github/vercel/supabase-official; mode=openapi_new instala servidor OpenAPI novo (cria registro + sync Swagger + hub); mode=registry_all registra todos os mcp_servers existentes; mode=openapi_sync re-sincroniza Swagger de um servidor.
WHEN NOT: Para conexão manual custom (use connect_mcp).
RETURNS: Relatório de instalação/sync com alias de uso.
PARAMS: mode(presets|registry_all|openapi_new|openapi_sync) + campos do mode (name, swagger_url, api_base_url, server_id...).
`.trim(),

	list_mcp_tools: `
Lista tools de um MCP filho (nome + descrição curta), conectando lazy se preciso.
WHEN TO USE: Descobrir o que um MCP filho oferece antes de chamar.
WHEN NOT: Para schema completo de uma tool (use get_mcp_tool_schema).
RETURNS: { alias, tools[] }
`.trim(),

	get_mcp_tool_schema: `
Retorna schema completo (inputSchema) de uma tool filha.
WHEN TO USE: Antes de call_mcp_tool com argumentos não triviais.
RETURNS: JSON schema da tool.
`.trim(),

	call_mcp_tool: `
Executa tool em MCP filho via hub lazy (conexão sob demanda, idle timeout 5min).
WHEN TO USE: Qualquer operação em GitHub/Vercel/OpenAPI registrados no hub.
Ex: { alias: 'github', tool_name: 'search_repositories', arguments: { query: '...' } }.
WHEN NOT: Para Supabase do projeto ativo (use call_supabase_tool).
RETURNS: Texto/JSON da tool filha; acima do cap vem com marcador TRUNCATED (head+tail).
PARAMS: alias, tool_name, arguments (objeto), max_chars? (cap do resultado; default env AGENT_OS_MCP_RESULT_MAX_CHARS=25000; <=0 desliga).
`.trim(),

	mcp_admin: `
Administração de conexões do hub: desconectar, remover, health check.
WHEN TO USE: action=disconnect fecha sessão; action=remove apaga conexão; action=refresh_health pinga listTools e atualiza cache.
RETURNS: Status da operação.
PARAMS: action(disconnect|remove|refresh_health), alias.
`.trim(),

	// ── runner ──────────────────────────────────────────────────────────────
	run_quality_gates: `
Executa typecheck/lint/build/test do workspace e retorna relatório.
WHEN TO USE: Ao finalizar qualquer tarefa de código, antes de entregar.
RETURNS: Relatório por gate com pass/fail e output.
`.trim(),

	summarize_diff: `
Resumo humano das mudanças git do workspace.
WHEN TO USE: Ao finalizar tarefa, para reportar o que mudou.
RETURNS: { summary }
`.trim(),

	rollback_task: `
Reverte alterações locais via git stash (recuperável). Sem confirm=true retorna só o preview.
WHEN TO USE: Apenas quando o usuário pedir para descartar mudanças locais — sempre com confirmação dele.
WHEN NOT: Nunca automaticamente após falha — pergunte antes.
RETURNS: { performed, changes, message, recoveryHint }
`.trim(),

	run_autofix_loop: `
Roda quality gates e delega correção automática em loop até passar ou atingir limite.
WHEN TO USE: Pós-implementação com erros de lint/type simples e mecânicos.
WHEN NOT: Erros de arquitetura ou lógica de negócio.
RETURNS: Relatório de iterações com status final.
`.trim(),

	// ── data (Supabase hub) ─────────────────────────────────────────────────
	hub_status: `
Visão geral do hub Supabase: contas, projetos, contexto ativo, keep-alive, scheduler.
WHEN TO USE: Ponto de partida antes de operar banco; confirma qual projeto está ativo.
WHEN NOT: Para status do Agent OS em si (use agent_os_status).
RETURNS: { accounts, projects, activeContext, keepAlive, scheduler }
`.trim(),

	list_accounts: `
Lista contas Supabase registradas (labels e ids) e o contexto ativo.
WHEN TO USE: Descobrir accountLabel antes de switch_project.
RETURNS: { count, accounts[], activeContext }
`.trim(),

	list_projects: `
Lista projetos Supabase em cache (todas as contas ou filtrado por accountId).
WHEN TO USE: Descobrir projectRef antes de switch_project. Use hub_admin action=sync_projects para atualizar o cache.
RETURNS: { count, projects[] }
`.trim(),

	switch_project: `
Alterna conta/projeto Supabase ativo. OBRIGATÓRIO antes de operar o banco.
WHEN TO USE: Sempre que o projeto ativo estiver errado ou indefinido. Ex: { accountLabel: 'minha-org', projectRef: 'abc123' }.
WHEN NOT: Se get_active_project já mostra o projeto correto.
RETURNS: { success, activeContext }
NOTES: Confirme com get_active_project. Depois use call_supabase_tool para SQL/tabelas.
`.trim(),

	get_active_project: `
Retorna conta e projeto Supabase ativos.
WHEN TO USE: SEMPRE antes de operações de banco, para confirmar o alvo.
RETURNS: { active, account, project, activeContext }
`.trim(),

	call_supabase_tool: `
Chama qualquer tool do MCP Supabase oficial no projeto ativo (list_tables, execute_sql, apply_migration, get_logs, etc).
WHEN TO USE: TODA operação de banco no projeto ativo. Ex: { tool_name: 'execute_sql', arguments: { query: 'select 1' } }.
WHEN NOT: Sem projeto ativo (rode switch_project primeiro). Para descobrir tools disponíveis (use list_supabase_tools).
RETURNS: Texto/JSON do MCP Supabase; acima do cap vem com marcador TRUNCATED (head+tail).
PARAMS: tool_name (alias legado: toolName), arguments (objeto), max_chars? (cap do resultado; default env AGENT_OS_MCP_RESULT_MAX_CHARS=25000; <=0 desliga).
NOTES: Substitui as antigas tools diretas list_tables/execute_sql/etc deste servidor.
`.trim(),

	list_supabase_tools: `
Lista as tools disponíveis no MCP Supabase oficial para o projeto ativo.
WHEN TO USE: Descobrir tool_name válidos para call_supabase_tool.
RETURNS: { tools[] }
`.trim(),

	keepalive: `
Keep-alive de projetos Supabase free tier (evita pausa por 7 dias de inatividade).
WHEN TO USE: action=register_all após sync de projetos; action=status para conferir; action=ping_all para ping manual; action=register para um projeto específico.
RETURNS: Entradas mascaradas (anonKey redacted) + schedulerStartedAt, lastSchedulerTickAt, lastSuccessfulPingAt.
PARAMS: action(register|register_all|ping_all|status), accountId?, projectRef?
`.trim(),

	hub_admin: `
Administração do hub Supabase: contas, sync, Management API e settings.
WHEN TO USE: action=add_account|remove_account|test_account|sync_projects|list_organizations|create_project|restore_project|update_settings|import_legacy.
WHEN NOT: Para operar o banco (use call_supabase_tool) ou trocar projeto (use switch_project).
RETURNS: Resultado da ação.
PARAMS: action + campos da ação (label/pat para add_account; accountId; readOnly/keepAliveCron para update_settings; etc).
`.trim(),

	export_mcp_config: `
Gera snippet mcp.json pronto para Cursor ou Antigravity.
WHEN TO USE: Setup de nova máquina/IDE.
RETURNS: Snippet JSON + instruções.
`.trim(),

	schema_context_for_task: `
Hints de schema Supabase relevantes para a tarefa (tabelas + colunas rankeadas pela intent).
WHEN TO USE: Antes de escrever SQL em projeto com muitas tabelas.
WHEN NOT: Para schema completo (use call_supabase_tool list_tables).
RETURNS: { active_project, source, schema_hints[], error? }. Requer switch_project ativo; source=list_tables quando parse OK.
`.trim(),

	// ── policy ──────────────────────────────────────────────────────────────
	upsert_policy: `
Cria ou atualiza policy allow/deny sobre intent + action_pattern.
WHEN TO USE: Bloquear/permitir ações específicas. action_pattern aceita glob de path (ex: "write:apps/x/api/**"), regex ou substring.
WHEN NOT: Para regra de projeto completa (use set_project_rule, que cria preferência + policy juntas).
RETURNS: Policy salva.
NOTES: Taxonomia de actions: write:<glob>, shell:<cmd>, delegate_task:<provider>, delegate_async:<provider>, sql:<op>. Deny tem precedência. Enforcement automático nas tools de delegação e nos hooks do Cursor (se instalados).
`.trim(),

	check_policy: `
Avalia se intent/action passam nas policies habilitadas.
WHEN TO USE: Antes de ação sensível (escrever em path protegido, rodar SQL destrutivo, delegar).
RETURNS: { allowed, matchedPolicy?, matchedCount, reason?, warning? }
NOTES: ATENÇÃO — default é allow: se nenhuma policy casar, allowed=true com warning explicando que nada casou. Não confunda "allow por ausência de match" com "allow explícito".
`.trim(),

	policy_admin: `
Administração de policies: listar, deletar, habilitar/desabilitar.
WHEN TO USE: action=list|delete|toggle.
WHEN NOT: Para criar/editar policy (use upsert_policy).
RETURNS: Lista, { ok } ou policy atualizada.
`.trim(),

	// ── projects (portfólio/registry) ───────────────────────────────────────
	list_agent_projects: `
Lista projetos do registry agent_projects (portfólio + perfis de workspace).
WHEN TO USE: Visão de portfólio ou localizar projeto por status/featured.
WHEN NOT: Para projetos Supabase do hub (use list_projects).
RETURNS: Projetos com slug, título, workspace_path, stack, status.
`.trim(),

	get_project: `
Busca projeto do registry por id ou slug.
RETURNS: Projeto completo ou null.
`.trim(),

	upsert_project: `
Cria ou atualiza projeto no registry (metadados, portfólio, workspace, stack).
WHEN TO USE: Editar dados do portfólio ou registrar projeto manualmente.
WHEN NOT: bootstrap_project já faz upsert automático do perfil de workspace.
RETURNS: Projeto salvo, ou warning se a key não tiver permissão de escrita (RLS).
`.trim(),

	delete_project: `
Remove projeto do registry (opcionalmente a capa no Storage).
WHEN TO USE: Apenas sob pedido explícito do usuário.
RETURNS: { ok: true }
`.trim(),

	sync_project: `
Sincronização unificada do projeto: GitHub, Vercel, docs ou capa.
WHEN TO USE: target=github puxa README/metadados; target=vercel puxa deploy URL; target=docs monta docs_md completo (save opcional); target=cover faz upload de capa (file_path ou base64).
RETURNS: Resultado do sync/upload.
PARAMS: target(github|vercel|docs|cover), id?/slug?, save?, file_path?, base64?, mime_type?
`.trim(),

	// ── orchestration extensions ────────────────────────────────────────────
	route_for_pedro: `
Sugere provider ideal (cursor/antigravity) para a intenção, usando as regras pessoais do Pedro.
WHEN TO USE: Escolher para quem delegar antes de delegate_task/delegate_async.
RETURNS: { provider, rationale, matched_rule, confidence }
`.trim(),

	handoff_session: `
Troca de IDE preservando sessão: injeta contexto e delega no provider alvo.
WHEN TO USE: Continuar trabalho iniciado em outro provider sem perder contexto.
RETURNS: { handoff, from, to, delegation }
`.trim(),

	resume_task: `
Retoma tarefa por task_id criando nova sessão delegada.
WHEN TO USE: Continuar tarefa registrada anteriormente (remember kind=task_log).
RETURNS: { task_id, session, delegation }
`.trim(),
};
