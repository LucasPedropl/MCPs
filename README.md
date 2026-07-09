# MCPs Monorepo

Monorepo centralizado com todos os servidores e ferramentas MCP do ecossistema.

Origem do [ServidorMCP](https://github.com/LucasPedropl/ServidorMCP) integrado como `apps/servidor-*`.

## Estrutura

```
MCPs/
├── packages/
│   ├── agent-os/          # Personal Agent OS (MCP unificado — uso diário)
│   ├── openapi-engine/    # Engine OpenAPI → MCP (sync, proxy, meta-tools)
│   └── shared/            # Tipos e helpers compartilhados
├── skills/              # Skills canônicas (pedro-defaults, supabase-workflows…)
├── apps/
│   └── servidor-web/    # Agent OS Dashboard (Next.js)
├── docs/                # Exemplos de configuração
└── migrations/          # Migrações SQL do Servidor MCP
```

## Pré-requisitos

- **Node.js** >= 22

## Instalação

Na raiz do monorepo:

```bash
npm install
npm run build
```

## Scripts (raiz)

| Script | Descrição |
|--------|-----------|
| `npm run build` | Build de todos os workspaces |
| `npm run typecheck` | Typecheck em todos os pacotes |
| `npm run dev:agent-os` | Personal Agent OS em modo dev |
| `npm run build:agent-os` | Build do agent-os |
| `npm run build:openapi-engine` | Build do openapi-engine |
| `npm run dev:servidor-web` | Agent OS Dashboard (Next.js) |

Também é possível usar `-w` diretamente:

```bash
npm run dev -w @mcps/agent-os
npm run build -w @mcps/openapi-engine
npm run build -w @mcps/servidor-web
```

## Configuração no Cursor (`mcp.json`)

**Recomendado:** um único MCP `agent-os`:

```json
{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPs/packages/agent-os/dist/index.js"],
      "env": {
        "AGENT_OS_SUPABASE_URL": "https://xrjjzyfevbuuxeundgds.supabase.co",
        "AGENT_OS_SUPABASE_KEY": "<sua_key>",
        "AGENT_OS_DEFAULT_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

Ver [docs/agent-os-mcp.json.example](docs/agent-os-mcp.json.example) e [packages/agent-os/README.md](packages/agent-os/README.md).

## Configuração no Antigravity (`mcp_config.json`)

Arquivo global: `C:\Users\<você>\.gemini\config\mcp_config.json`  
(Antigravity → MCP Servers → Manage → **View raw config**)

```json
{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPs/packages/agent-os/dist/index.js"],
      "env": {
        "AGENT_OS_SUPABASE_URL": "https://xrjjzyfevbuuxeundgds.supabase.co",
        "AGENT_OS_SUPABASE_KEY": "<sua_key>",
        "AGENT_OS_DEFAULT_CWD": "${workspaceFolder}",
        "AGENT_OS_REALTIME_WORKER": "0",
        "SUPABASE_HUB_CONFIG_DIR": "C:/Users/Pedro/.supabase-mcp-hub"
      }
    }
  }
}
```

Ver [docs/agent-os-antigravity-mcp.json.example](docs/agent-os-antigravity-mcp.json.example).

## Pacotes

### `@mcps/agent-os` (principal)

Personal Agent OS — memória, contexto, orquestração, hub lazy de MCPs, Supabase data plane, skills e quality gates. Ver [packages/agent-os/README.md](packages/agent-os/README.md).

### `@mcps/openapi-engine`

Engine OpenAPI → MCP: sincronização de specs, proxy HTTP, runtime de meta-tools e QA. Consumido pelo Agent OS e pelo dashboard.

### `@mcps/servidor-web`

Agent OS Dashboard — cadastrar, sincronizar e testar servidores MCP via Swagger/OpenAPI. Runtime em `@mcps/openapi-engine`.

### `@mcps/shared`

Pacote reservado para tipos, schemas e helpers reutilizáveis entre os MCPs.

## Banco Supabase centralizado

Todos os MCPs que precisam de persistência usam o projeto **MCP Servers** (`xrjjzyfevbuuxeundgds`):

| Pacote | Tabelas |
|--------|---------|
| `@mcps/agent-os` | `agent_*`, `mcp_hub_connections`, `delegation_*`, `job_events`… |
| `@mcps/servidor-web` | `mcp_*` (registry, tools, testes) |

Requer `apps/servidor-web/.env.local` e `.cursor/mcp.json` **neste repositório** (config local do workspace, não global).

Migrações em `migrations/` (003–011 Agent OS core, policies, snapshots, projects registry).

O workspace `@mcps/shared` já está configurado. Para usar em outro pacote:

```json
"dependencies": {
  "@mcps/shared": "*"
}
```

Depois importe normalmente:

```ts
import { MCPS_MONOREPO_VERSION } from "@mcps/shared";
```

## VS Code / Cursor

Tasks e launch configs em `.vscode/`. Use o compound **Agent OS Dashboard** para subir o painel.
