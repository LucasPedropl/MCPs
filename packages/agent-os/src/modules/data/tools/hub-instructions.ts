/**
 * Instruções MCP expostas a agentes (Cursor, Antigravity, etc.).
 * Manter em linguagem imperativa e com fluxos explícitos.
 */
export const HUB_INSTRUCTIONS = `
# Supabase MCP Hub

**Padrão obrigatório** para projetos com backend Supabase. Use este MCP (\`supabase-hub\`) — **não** o MCP remoto \`supabase\` nem OAuth.

Hub local que gerencia VÁRIAS contas Supabase com um único MCP. Cada conta tem seu PAT; você troca de conta/projeto sem relogar.

## Antes de qualquer operação no banco

SEMPRE verifique o contexto ativo:
1. \`get_active_project\` — mostra conta + projectRef em uso agora
2. Se errado ou vazio → \`switch_project\` ANTES de \`list_tables\`, \`execute_sql\`, etc.

As tools Supabase oficiais (list_tables, execute_sql, apply_migration...) são PROXY: usam o projeto ativo.

## Descobrir contas e projetos

| Situação | Tools |
|----------|-------|
| Ver contas | \`list_accounts\` |
| Ver projetos em cache | \`list_projects\` (opcional: accountId) |
| Atualizar lista da API | \`sync_projects\` (sem args = todas as contas) |
| Visão geral | \`hub_status\` |

## Alternar entre contas (multi-conta)

\`switch_project\` requer **projectRef** (obrigatório) + **accountLabel** OU **accountId**:

1. \`list_accounts\` → anote os labels (ex: "default", "minha-org", "pessoal")
2. \`list_projects\` → anote o projectRef (ex: "enqpcrvqmzuyzglgwnrk")
3. \`switch_project\` com { accountLabel: "minha-org", projectRef: "xrjjzyfevbuuxeundgds" }
4. Confirme com \`get_active_project\`
5. Agora use \`list_tables\`, \`execute_sql\`, etc.

Se omitir accountLabel/accountId, o hub usa a conta do contexto ativo anterior (pode causar erro se o projectRef for de outra conta).

## Setup inicial (conta nova)

1. \`add_account\` — label + PAT (token de https://supabase.com/dashboard/account/tokens)
2. \`sync_projects\` — sincroniza projetos; tenta registrar keep-alive
3. \`switch_project\` — escolhe projeto ativo
4. \`register_all_keepalive\` — garante ping em todos os projetos (free tier pausa após 7 dias)

Atalho migração: \`import_from_legacy_supabase\` com pat opcional.

## Keep-alive (projetos free tier)

- Scheduler no processo MCP: ping a cada **12h** em \`/auth/v1/health\` (cron default \`0 */12 * * *\`)
- Ping automático na inicialização do scheduler (runOnInit)
- Para confiabilidade 24/7, use worker dedicado: \`AGENT_OS_KEEPALIVE_WORKER=1\` + \`node dist/keepalive-worker-entry.js\`
- \`register_all_keepalive\` — registra TODOS os projetos em cache
- \`register_keepalive\` — um projeto específico (accountId + projectRef)
- \`ping_all_projects\` / \`keepalive action=ping_all\` — teste manual
- \`get_keepalive_status\` / \`keepalive action=status\` — último ping, latência, schedulerStartedAt, lastSchedulerTickAt
- Projeto pausado: \`restore_project\` (accountId + projectRef)

**Nota:** o MCP stdio não fica 24/7 ligado — \`schedulerRunning\` indica apenas que o cron foi criado nesta sessão.

## Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Nenhum projeto ativo" | switch_project não chamado | switch_project primeiro |
| "Conta X não encontrada" | label errado | list_accounts |
| JWT / timeout | projeto pausado ou PAT errado | restore_project ou switch de conta |
| Anon key indisponível | API key desabilitada no dashboard | habilitar no Supabase + register_keepalive |

## Tools de gestão vs proxy

- **Gestão:** add_account, list_accounts, sync_projects, switch_project, hub_status, keep-alive...
- **Proxy (banco):** list_tables, execute_sql, apply_migration, get_logs... — exigem projeto ativo correto
`.trim();
