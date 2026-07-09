# Agent OS Dashboard (`@mcps/servidor-web`)

Dashboard Next.js para gerenciar memória, skills, hub de MCPs, APIs OpenAPI e orquestração.

## Setup

```bash
# Na raiz do monorepo
npm install
npm run build

# Copiar env e preencher
cp apps/servidor-web/.env.example apps/servidor-web/.env.local

# Subir dashboard
npm run dev:servidor-web
```

Abra [http://localhost:3000/agent-os](http://localhost:3000/agent-os).

## Variáveis de ambiente (`.env.local`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role (API routes server-side) |
| `NEXT_PUBLIC_API_URL` | Não | URL do gateway SSE legado (default `localhost:3001`) |

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/agent-os` | Overview |
| `/agent-os/memory` | Preferências, decisões, pitfalls |
| `/agent-os/knowledge` | Hub skills/playbooks |
| `/agent-os/hub` | Conexões MCP lazy |
| `/agent-os/jobs` | Orquestração multi-IDE |
| `/agent-os/mcp-servers` | APIs OpenAPI |
| `/agent-os/settings` | Configuração e snippets MCP |

## API routes

Namespace `/api/agent-os/*` — CRUD de memória, knowledge, hub, jobs, settings.

Rotas OpenAPI legadas: `/api/parse-swagger`, `/api/sync-server`, `/api/run-test-case`.
