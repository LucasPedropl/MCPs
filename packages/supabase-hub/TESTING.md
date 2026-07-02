# Checklist de Teste Manual - Supabase MCP Hub

Este documento contém o checklist para validação manual de todas as ferramentas
(tools) do Supabase MCP Hub.

## 1. Gerenciamento de Contas (Accounts)

- [ ] **add_account**
    - **Entrada:** `label` (ex: "Minha Conta"), `pat` (Personal Access Token
      válido).
    - **Validação:** Retorna `{ success: true, account: { id, label } }`. O
      token não deve ser exposto no retorno.
    - **Teste de Erro:** Tentar cadastrar com PAT vazio ou inválido. Deve
      retornar erro amigável.
- [ ] **list_accounts**
    - **Entrada:** `{}`.
    - **Validação:** Retorna a lista de contas salvas, contendo `id`, `label`, e
      o `activeContext` (se houver). O campo `pat` não deve aparecer.
- [ ] **test_account**
    - **Entrada:** `accountId` (UUID de uma conta registrada).
    - **Validação:** Retorna `{ accountId, valid: true }` se o PAT for válido e
      a comunicação com a API do Supabase funcionar.
- [ ] **remove_account**
    - **Entrada:** `accountId` (UUID de uma conta registrada).
    - **Validação:** Retorna `{ success: true, accountId }`. Após a remoção, a
      conta não deve aparecer no `list_accounts` e as credenciais devem ser
      removidas do Credential Manager.

## 2. Gerenciamento de Projetos (Projects)

- [ ] **sync_projects**
    - **Entrada:** `accountId` (opcional).
    - **Validação:** Sincroniza os projetos da conta ativa ou de todas as contas
      cadastradas com a API do Supabase e salva no cache local. Retorna
      `{ success: true, count, projects }`.
- [ ] **list_projects**
    - **Entrada:** `accountId` (opcional).
    - **Validação:** Retorna a lista de projetos salvos em cache local. Se o
      `accountId` for passado, filtra apenas os daquela conta.
- [ ] **list_organizations**
    - **Entrada:** `accountId` (UUID).
    - **Validação:** Retorna a lista de organizações associadas a essa conta no
      Supabase.
- [ ] **switch_project**
    - **Entrada:** `projectRef` (obrigatório) e `accountId` ou `accountLabel`
      (opcional).
    - **Validação:** Define o projeto especificado como ativo no contexto do
      hub. Retorna `{ success: true, activeContext }`.
- [ ] **get_active_project**
    - **Entrada:** `{}`.
    - **Validação:** Retorna `{ active: true, account, project, activeContext }`
      se houver um projeto ativo configurado.
- [ ] **create_project**
    - **Entrada:** `accountId`, `name`, `dbPassword`, `organizationId`,
      `region`.
    - **Validação:** Cria um novo projeto na API do Supabase, sincroniza com o
      cache local e ativa o keep-alive para ele. Retorna
      `{ success: true, project }`.
- [ ] **restore_project**
    - **Entrada:** `accountId`, `projectRef`.
    - **Validação:** Reativa um projeto que estava pausado por inatividade.
      Retorna `{ success: true, projectRef }`.

## 3. Keep-Alive

- [ ] **register_keepalive**
    - **Entrada:** `accountId`, `projectRef`.
    - **Validação:** Registra o projeto específico no arquivo de keep-alive.
      Retorna `{ success: true, entry }`.
- [ ] **register_all_keepalive**
    - **Entrada:** `{}`.
    - **Validação:** Varre todos os projetos em cache e registra todos eles no
      keep-alive. Retorna `{ success: true, count, entries }`.
- [ ] **ping_all_projects**
    - **Entrada:** `{}`.
    - **Validação:** Dispara um ping HTTP imediato contra todos os projetos
      registrados na rota `/auth/v1/health` para evitar que sejam pausados.
      Retorna os resultados dos pings.
- [ ] **get_keepalive_status**
    - **Entrada:** `{}`.
    - **Validação:** Retorna `{ cron, entries }` listando a recorrência
      configurada e os status dos últimos pings de cada projeto.

## 4. Meta e Configurações

- [ ] **hub_status**
    - **Entrada:** `{}`.
    - **Validação:** Retorna o status geral do hub, incluindo contagem de
      contas, projetos salvos em cache, status do scheduler e do banco de dados.
- [ ] **export_mcp_config**
    - **Entrada:** `target` ("cursor" ou "antigravity"), `mode` ("hub-only" ou
      "multi-project"), `hubDistPath` (opcional).
    - **Validação:** Gera o JSON de configuração do MCP formatado para inclusão
      direta nas definições do editor.
- [ ] **import_from_legacy_supabase**
    - **Entrada:** `pat` (opcional), `label` (opcional), `projectRef`
      (opcional).
    - **Validação:** Importa as configurações legadas do Supabase e ativa o
      projeto.

## 5. Proxy do Supabase Oficial

- [ ] **list_supabase_tools**
    - **Entrada:** `{}`.
    - **Validação:** Retorna as ferramentas expostas pelo MCP oficial da
      Supabase para o projeto ativo selecionado.
- [ ] **call_supabase_tool**
    - **Entrada:** `toolName` (ex: "list_tables"), `arguments`.
    - **Validação:** Encaminha a execução para a ferramenta no MCP remoto do
      Supabase e retorna os dados originais.
- [ ] **Ferramentas Proxied Diretas** (ex: `list_tables`, `execute_sql`,
      `get_logs`)
    - **Entrada:** Argumentos específicos de cada ferramenta (ex: `query` para
      `execute_sql`).
    - **Validação:** Devem funcionar de forma transparente no projeto ativo
      configurado por `switch_project`.
