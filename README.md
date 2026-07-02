# MCPs Monorepo

Monorepo centralizado com todos os servidores e ferramentas MCP do ecossistema.

Origem do [ServidorMCP](https://github.com/LucasPedropl/ServidorMCP) integrado como `apps/servidor-*`.

## Estrutura

```
MCPs/
├── packages/
│   ├── supabase-hub/    # MCP multi-conta Supabase (proxy + keep-alive)
│   ├── communication/   # Bridge Cursor ↔ Antigravity ↔ Copilot
│   └── shared/          # Utilitários compartilhados (uso futuro)
├── apps/
│   ├── servidor-web/    # Dashboard Next.js para gestão de MCPs
│   └── servidor-api/    # API Express + engine MCP (sync, proxy, testes)
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
| `npm run dev:supabase` | MCP Supabase Hub em modo dev |
| `npm run dev:communication` | MCP Communication em modo dev |
| `npm run dev:servidor-web` | Next.js do Servidor MCP |
| `npm run dev:servidor-api` | API do Servidor MCP |

Também é possível usar `-w` diretamente:

```bash
npm run dev -w @mcps/supabase-hub
npm run build -w @mcps/servidor-web
```

## Configuração no Cursor (`mcp.json`)

Após o build, aponte para os `dist/index.js` de cada pacote MCP:

```json
{
  "mcpServers": {
    "supabase-hub": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPs/packages/supabase-hub/dist/index.js"]
    },
    "ide-bridge": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPs/packages/communication/dist/index.js"],
      "env": {
        "BRIDGE_DEFAULT_CWD": "C:/caminho/do/seu/projeto"
      }
    }
  }
}
```

## Pacotes

### `@mcps/supabase-hub`

Hub MCP para múltiplas contas e projetos Supabase. Ver [packages/supabase-hub/README.md](packages/supabase-hub/README.md).

### `@mcps/communication`

Delegação de tarefas entre IDEs e agentes. Ver [packages/communication/README.md](packages/communication/README.md).

### `@mcps/servidor-web` + `@mcps/servidor-api`

Plataforma web para cadastrar, sincronizar e testar servidores MCP via Swagger/OpenAPI. Baseado no repositório [LucasPedropl/ServidorMCP](https://github.com/LucasPedropl/ServidorMCP).

### `@mcps/shared`

Pacote reservado para tipos, schemas e helpers reutilizáveis entre os MCPs.

## Banco Supabase centralizado

Todos os MCPs que precisam de persistência usam o projeto **MCP Servers** (`xrjjzyfevbuuxeundgds`):

| Pacote | Tabelas |
|--------|---------|
| `@mcps/servidor-web` + `servidor-api` | `mcp_*` (registry, tools, testes) |
| `@mcps/communication` | `delegation_*`, `job_events`, `workspace_locks`… |

### MCPs REST registrados (Bixs)

| MCP no Cursor | Servidor Supabase | Swagger | Endpoints |
|---------------|-------------------|---------|-----------|
| `bixs-ai-mcp` | Bixs AI | [ai/doc.json](https://api.bixs.com.br/docs/ai/doc.json) | 3 (`/chat`, `/chat/simple`, `/config`) |
| `bixs-gateway-mcp` | Bixs Gateway | [gateway/doc.json](https://api.bixs.com.br/docs/gateway/doc.json) | 15 (auth, mídia, webhooks) |

Requer `apps/servidor-api/.env` e `.cursor/mcp.json` **neste repositório** (config local do workspace, não global).


Migrações em `migrations/`. O projeto **MCP-Bright** pode ser pausado após validação.


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

Tasks e launch configs em `.vscode/` cobrem todos os serviços. Use **"Iniciar Servidor MCP (Web + API)"** para subir o dashboard completo.
