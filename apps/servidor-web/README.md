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

## Deploy na Vercel (monorepo)

O dashboard é `apps/servidor-web`, **não** `packages/agent-os`.

No projeto Vercel:

| Setting | Valor |
|---------|--------|
| **Root Directory** | `apps/servidor-web` |
| Framework | Next.js |
| Install / Build | já definidos em [`vercel.json`](./vercel.json) (instala na raiz do monorepo + `build:packages`) |

Se o log mostrar `> @mcps/agent-os@0.1.0 build` + `tsup`, o Root Directory está errado.

Env vars (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_SESSION_SECRET`.

## Variáveis de ambiente (`.env.local`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon (login + client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role (API routes server-side) |
| `DASHBOARD_SESSION_SECRET` | Não | Segredo HMAC do cookie (≥16 chars). Se omitido, usa a service role |
| `NEXT_PUBLIC_API_URL` | Não | URL do gateway SSE legado (default `localhost:3001`) |

### Auth

- **Credenciais** ficam no **Supabase Auth** (não no `.env`)
- Login: [`/login`](http://localhost:3000/login) → `signInWithPassword` → cookie httpOnly `agent_os_session`
- **Lembrar-me**: cookie até logout (teto prático ~400 dias nos browsers; 12h sem marcar)
- Logout: botão **Sair** no topbar
- Crie o usuário em Authentication → Users (ou via Admin API / script de seed)

Sem Supabase configurado, o middleware **bloqueia** o painel (fail-closed).
## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/login` | Login do dashboard |
| `/agent-os` | Overview |
| `/agent-os/usage` | Telemetria de tools |
| `/agent-os/memory` | Preferências, decisões, pitfalls |
| `/agent-os/knowledge` | Hub skills/playbooks |
| `/agent-os/hub` | Conexões MCP lazy |
| `/agent-os/jobs` | Orquestração multi-IDE |
| `/agent-os/mcp-servers` | APIs OpenAPI |
| `/agent-os/settings` | Configuração e snippets MCP |

## API routes

Namespace `/api/agent-os/*` — CRUD de memória, knowledge, hub, jobs, settings (exige sessão).

Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.

Rotas OpenAPI legadas: `/api/parse-swagger`, `/api/sync-server`, `/api/run-test-case`.
