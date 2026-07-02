Monorepo: instale e faça build na **raiz** (`npm install && npm run build`). Ver [README.md](../../README.md).

# Supabase MCP Hub

O **Supabase MCP Hub** é um servidor MCP (Model Context Protocol) centralizado
para gerenciar múltiplas contas e projetos do Supabase diretamente do seu editor
(Cursor/VSCode). Ele permite o gerenciamento de contas via Personal Access
Tokens (PAT), sincronização de projetos, alternância rápida entre contextos
(projetos) e atua como proxy para as ferramentas oficiais do MCP do Supabase,
além de fornecer um mecanismo de _keep-alive_ para evitar que seus projetos
gratuitos sejam pausados por inatividade.

## Pré-requisitos

- **Node.js**: Versão 22 ou superior.
- **Supabase PAT**: Um _Personal Access Token_ gerado no dashboard do Supabase
  (Account -> Access Tokens).

## Instalação

Clone o repositório e instale as dependências:

```bash
npm install
npm run build
```

## Configuração no Cursor

Adicione o snippet abaixo no seu arquivo de configuração do MCP no Cursor
(geralmente em `Cursor Settings > Features > MCP` ou editando o `mcp.json`):

```json
{
	"mcpServers": {
		"supabase-hub": {
			"command": "node",
			"args": ["C:/codigo/pessoal/MCPs/packages/supabase-hub/dist/index.js"]
		}
	}
}
```

_(Ajuste o caminho conforme o diretório exato do projeto em sua máquina)._

## Fluxo Rápido (Quick Start)

Para começar a usar, siga o fluxo básico através das tools do MCP:

1. **`add_account`**: Registre sua conta do Supabase informando seu PAT.
2. **`sync_projects`**: Sincronize a lista de projetos da sua conta para o cache
   local.
3. **`switch_project`**: Escolha o projeto ativo para o qual as requisições
   serão direcionadas.
4. **`list_tables`** (ou outras tools do Supabase oficial): Execute as operações
   desejadas no projeto ativo.

## Sistema de Keep-Alive

O Supabase pausa projetos gratuitos após 7 dias de inatividade. O Supabase MCP
Hub possui um sistema automático de **keep-alive** que realiza pings periódicos
(a cada 3 dias, acessando a rota `/auth/v1/health`) nos seus projetos
registrados. Isso garante que os projetos que você está gerenciando ativamente
através do Hub permaneçam online.

## Segurança

- **Credenciais Seguras**: O seu PAT do Supabase é salvo de forma segura no
  **Windows Credential Manager** utilizando a biblioteca `keytar` (ou fallback
  seguro).
- **Nunca Comite Tokens**: Os tokens nunca são salvos em arquivos de texto plano
  ou `.json` no repositório. O arquivo de configuração do hub armazena apenas
  metadados.

## Ferramentas Disponíveis (MCP Tools)

O hub expõe as seguintes ferramentas que podem ser utilizadas pelo LLM no seu
editor:

### Contas (Accounts)

- `add_account`: Registra uma nova conta com um PAT.
- `list_accounts`: Lista todas as contas cadastradas.
- `remove_account`: Remove uma conta e seus projetos em cache.
- `test_account`: Valida o PAT de uma conta.

### Projetos (Projects)

- `list_projects`: Lista os projetos que estão no cache local.
- `sync_projects`: Sincroniza os projetos da conta com o Supabase.
- `list_organizations`: Lista as organizações vinculadas à conta.
- `switch_project`: Define qual projeto será o ativo no momento.
- `get_active_project`: Retorna o projeto ativo.
- `create_project`: Cria um novo projeto no Supabase.
- `restore_project`: Restaura um projeto pausado.

### Keep-Alive

- `register_keepalive`: Registra um projeto para receber pings antibloqueio.
- `register_all_keepalive`: Registra todos os projetos conhecidos.
- `ping_all_projects`: Força um ping imediato em todos os projetos.
- `get_keepalive_status`: Mostra o status do sistema de keep-alive.

### Meta / Config
- `hub_status`: Status geral do hub (contas, projetos, scheduler).
- `export_mcp_config`: Gera snippet para Cursor/Antigravity.
- `import_from_legacy_supabase`: Importa PAT e ativa projeto legado.

### Variáveis de ambiente
- `SUPABASE_HUB_CONFIG_DIR`: diretório de configuração.
- `SUPABASE_HUB_WEBHOOK_URL`: webhook para alertas de keep-alive falho.
- `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PAT`: PAT para import_from_legacy_supabase.

### Proxy / Supabase Oficial

- `call_supabase_tool`: Chama explicitamente uma tool do MCP Supabase.
- `list_supabase_tools`: Lista as tools do MCP remoto (Supabase oficial).
- As ferramentas oficiais (como `execute_sql`, `list_tables`, etc.) também são
  mapeadas e repassadas automaticamente para o projeto ativo selecionado.
