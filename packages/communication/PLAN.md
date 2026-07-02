# MCPcomunication — Plano de Evolução

> Orquestração: **Cursor** (este agente) coordena **Antigravity** e **Copilot CLI** via MCP `ide-bridge`.
> Persistência: **Supabase** (`xrjjzyfevbuuxeundgds` — projeto **MCP Servers**).

## Estado atual (Fase 1–3) ✅

- Delegação síncrona: Antigravity, Cursor, Copilot
- Auto-launch Antigravity, discovery de porta, TLS
- `bridge_status`, `list_models`, `delegate_task`, `delegate_and_wait`

---

## Fase 4 — Trabalho assíncrono ✅ (v0.2.0)

**Objetivo:** delegar sem bloquear o agente; consultar status depois.

| Entrega | Tool MCP | Status |
|---------|----------|--------|
| Schema Supabase | `delegation_jobs`, `job_events` | ✅ |
| Cliente Supabase | env `BRIDGE_SUPABASE_*` | ✅ |
| Executor em background | `JobRunner` | ✅ |
| Delegação async | `delegate_async` | ✅ |
| Consulta | `get_job_status` | ✅ |
| Histórico | `list_jobs` | ✅ |
| Cancelamento | `cancel_job` | ✅ |
| Diagnóstico | `job_store_status` | ✅ |

### Variáveis de ambiente (global `~/.cursor/mcp.json`)

```json
"env": {
  "BRIDGE_SUPABASE_URL": "https://xrjjzyfevbuuxeundgds.supabase.co",
  "BRIDGE_SUPABASE_KEY": "<anon ou service_role>"
}
```

---

## Fase 5 — Parallel + orquestração ✅ (v0.3.0)

| Entrega | Tool MCP | Status |
|---------|----------|--------|
| Delegação paralela | `delegate_parallel` | ✅ |
| Merge strategies | `raw_all` \| `best_of` \| `consensus` | ✅ |
| Router por prompt | `route_prompt` | ✅ |
| Jobs paralelos async | `delegate_parallel` + `async: true` | ✅ |
| Schema | `parent_job_id`, provider `parallel` | ✅ |

---

## Fase 6 — Sessões e contexto ✅ (v0.4.0)

| Entrega | Tool MCP | Status |
|---------|----------|--------|
| Sessões persistidas | `create_session`, `get_session`, `list_sessions` | ✅ |
| Context pack | `add_context` | ✅ |
| Resume cross-provider | `continue_session` | ✅ |
| Resume nativo Antigravity | cascadeId existente | ✅ |
| Schema | `delegation_sessions`, `shared_context` | ✅ |

---

## Fase 7 — Observabilidade ✅ (v0.5.0)

| Entrega | Tool MCP | Status |
|---------|----------|--------|
| Streaming chunks | `get_job_chunks` + eventos `chunk` | ✅ |
| Health histórico | `get_health_history`, `record_health_check` | ✅ |
| Auto-snapshot | `bridge_status` grava snapshots | ✅ |
| Schema | `provider_health_snapshots` | ✅ |
| Dashboard Next.js | Opcional | ⏳ |

---

## Fase 8 — Pipeline multi-agente ✅ (v0.6.0)

| Entrega | Tool MCP | Status |
|---------|----------|--------|
| Pipeline encadeado | `run_pipeline` | ✅ |
| Status + filhos | `get_pipeline_status` | ✅ |
| Steps padrão | plan→implement→review→fix | ✅ |
| Schema | provider `pipeline`, `parent_job_id` | ✅ |

---

## Prioridade de implementação (Fases 4–8) ✅

1. **4A** Job store + async tools ✅
2. **5** Parallel ✅
3. **6** Sessions ✅
4. **7** Streaming + health ✅
5. **8** Pipeline ✅

> **Dashboard Next.js (Fase 7 opcional):** pulado por decisão do usuário.

---

# Fase 9 — Estabilidade e production-grade (v0.7.0) 🚧

**Objetivo:** tornar o bridge confiável para uso real em repos, corrigir gaps críticos dos providers.

> **Copilot:** plano **GitHub Copilot Student** — uso **light** apenas (tokens limitados).  
> Env: `BRIDGE_COPILOT_PROFILE=light` (padrão). Pipeline/review migrados para Antigravity.

## 9.0 — Dev experience ✅ (v0.7.0)

| Entrega | Como usar | Status |
|---------|-----------|--------|
| Hot-reload MCP | `mcp.json` → `npm run mcp:dev` + `BRIDGE_HOT_RELOAD=1` | ✅ |
| Build watch | `npm run build:watch` + `node dist/index.js` com hot-reload | ✅ |
| Copilot light profile | `BRIDGE_COPILOT_PROFILE=light` | ✅ |
| Copilot JSON parser | `providers/copilot/parser.ts` | ✅ |
| Copilot read_tools | `read_tools: true` em delegate | ✅ |
| Auth probes | `bridge_status` → providers.authenticated | ✅ |
| Pipeline review → Antigravity | `templates.ts` | ✅ |
| Router Copilot depriorizado | `router.ts` | ✅ |

### Hot-reload no Cursor (config dev)

```json
{
  "mcpServers": {
    "ide-bridge": {
      "command": "npm",
      "args": ["run", "mcp:dev"],
      "cwd": "C:/codigo/pessoal/MCPcomunication",
      "env": {
        "BRIDGE_HOT_RELOAD": "1",
        "BRIDGE_COPILOT_PROFILE": "light",
        "BRIDGE_DEFAULT_CWD": "C:/codigo/pessoal/MCPcomunication",
        "BRIDGE_SUPABASE_URL": "...",
        "BRIDGE_SUPABASE_KEY": "..."
      }
    }
  }
}
```

Ao salvar arquivos em `src/`, o processo reinicia automaticamente. Se o Cursor não reconectar, clique **Restart** no painel MCP (sem matar todos os processos Node).

### Isolamento por branch + merge automático (v0.7.3)

| Agente | Branch / pasta | Quando |
|--------|----------------|--------|
| **Cursor (você)** | Branch atual do repo | Sempre — workspace aberto no IDE |
| **Antigravity agentic (IDE)** | Mesma branch | ConnectRPC edita o workspace da IDE aberta |
| **Antigravity headless** | `bridge/antigravity/{id}` | `BRIDGE_ANTIGRAVITY_HEADLESS=1` + agy disponível |
| **Copilot/Cursor CLI agentic** | `bridge/{provider}/{id}` | Worktree em `.bridge-worktrees/` (padrão) |

**Merge CI (sem aprovação manual):** ao concluir delegação agentic isolada, o bridge commita alterações pendentes, faz merge na branch base e resolve conflitos automaticamente (`git-merge.ts`).

| Env | Default | Efeito |
|-----|---------|--------|
| `BRIDGE_AUTO_MERGE` | `1` | Merge automático ao fim da delegação |
| `BRIDGE_MERGE_STRATEGY` | `smart` | `smart` → merge → `-X theirs` → resolução por marcadores (prefere branch da delegação) |
| `BRIDGE_ISOLATE_WORKSPACE` | `1` | Worktrees isolados |

Resposta inclui `merge: { merged, targetBranch, resolution, conflicts? }`.

## 9A — Fundação (prioridade máxima) ✅

| # | Entrega | Tool / módulo | Status |
|---|---------|---------------|--------|
| 1 | Workspace mutex / git worktree isolation | `lock-store.ts`, parallel-runner | ✅ |
| 2 | Polling agentic Antigravity (fim de edições) | `utils/polling.ts` | ✅ |
| 3 | Modo `bridge` Antigravity estável | `providers/antigravity/service.ts` | ✅ |
| 4 | Auth detection Cursor + Copilot no status | `bridge_status`, `providers/status.ts` | ✅ |
| 5 | Retry + max attempts + orphan job recovery | `job-recovery.ts`, `job-runner.ts` | ✅ |
| 6 | Sanitização de secrets nos chunks | `chunk-sanitizer.ts` | ✅ |
| 7 | Fallback headless `agy -p` | `providers/antigravity/headless.ts` | ✅ |
| 1b | Git worktree / branch isolada | `git-worktree.ts`, `delegation.ts` | ✅ |

## 9B — Resiliência

| # | Entrega | Tool / módulo | Status |
|---|---------|---------------|--------|
| 8 | Pipeline checkpoint + `resume_pipeline` | `pipeline-runner.ts` | ✅ |
| 9 | Dead Letter Queue (DLQ) | `job-dlq.ts` + `list_dlq_jobs` | ✅ |
| 10 | Circuit breaker + fallback chain | `providers/fallback.ts` | ✅ |
| 11 | Refactor `IProviderAdapter` | `providers/adapter.ts` | ✅ |
| 12 | Telemetria tokens/custo por job | `job-metrics.ts` + `get_job_metrics` | ✅ |
| 13 | Cancelamento em cascata (pipeline/parallel) | `job-runner.ts` | ✅ |

## 9E — Antigravity paralelo no mesmo repo (v0.7.5) ✅

**Objetivo:** múltiplas tarefas no mesmo projeto, sem abrir janelas extras na tela.

| Modo | Como funciona | UI |
|------|---------------|-----|
| **Subagent (chat/análise)** | Pool de cascades `SDK_EXECUTABLE` na mesma instância LS | Invisível — só background |
| **Agentic (edita código)** | Worktree por tarefa + `agy -p` headless (`windowsHide`) | Sem janela extra |
| **Merge** | Auto-merge CI na branch base ao concluir | — |

| Env | Default | Efeito |
|-----|---------|--------|
| `BRIDGE_ANTIGRAVITY_PARALLEL` | `1` | Worktree + headless para agentic paralelo |
| `BRIDGE_ANTIGRAVITY_MAX_CONCURRENT` | `4` | Máx. cascades subagent simultâneos |
| `BRIDGE_ANTIGRAVITY_HEADLESS_CLI` | — | Caminho do `agy.exe` se não estiver no PATH |

> **Requisito agentic paralelo:** binário `agy` no PATH (CLI headless). Subagent read-only funciona só com a IDE já aberta.

## 9F — Model router + v0.9.0 ✅

Roteamento inteligente Antigravity por pool de créditos:

| Categoria | Modelo | Pool |
|-----------|--------|------|
| summarize/probe | Gemini Flash High | Gemini |
| implement/fix | Gemini Pro High | Gemini |
| review/refactor | Claude Sonnet 4.6 | Externo |
| architecture/plan | Claude Opus 4.6 | Externo |
| general | GPT-OSS 120B | Externo |

Env: modelo explícito em `delegate_*` sempre tem prioridade sobre auto-rota.

---

| # | Entrega | Tool MCP | Status |
|---|---------|----------|--------|
| 14 | HITL — `approve_job_step` | `approve_job_step` | ✅ |
| 15 | Context compression entre steps | `pipeline/context-compress.ts` | ✅ |
| 16 | Validação Zod por step role | `pipeline/validators.ts` | ✅ |
| 17 | Limite loop review→fix (max 2) | `pipeline-runner.ts` | ✅ |
| 18 | Listagem dinâmica Copilot/Cursor | `list_models` | ✅ |
| 19 | GitHub webhook trigger | `webhooks/github-handler.ts` | ✅ |
| 20 | Worker event-driven (Supabase Realtime) | `realtime-worker.ts` | ✅ |

---

# Investigação — Copilot abaixo do esperado

> Consulta em 2026-06-22: Antigravity respondeu análise completa (~40s). Copilot via MCP retornou greeting genérico. Cursor falhou por auth.

## Diagnóstico: por que o Copilot parece limitado

O Copilot **não é um modelo inferior** — a integração atual do bridge **subutiliza** a CLI e **contamina** a resposta.

### Causa 1 — Integração mínima vs Cursor/Antigravity

| Capacidade | Antigravity | Cursor | Copilot (atual) |
|------------|:-----------:|:------:|:---------------:|
| API nativa / JSON | ConnectRPC + polling | `--output-format json` | stdout texto bruto |
| Session resume | cascadeId | sessionId | ❌ não implementado |
| Agentic completo | agenticMode | `--force --trust` | só `--allow-all-tools` |
| Progress streaming | onProgress | onChunk | onChunk (ruído) |
| Contexto longo | maxOutputTokens | implícito | ❌ sem `--context long_context` |

**Arquivo:** `src/providers/copilot/service.ts` — apenas `-p`, `-s`, `--no-ask-user`, `--model`, e opcionalmente `--allow-all-tools`.

### Causa 2 — `agentic_mode: false` por padrão bloqueia ferramentas

- Bridge tools default: `agentic_mode: false` (`bridge.ts`)
- Pipeline step `review`: Copilot com `agentic_mode: false` (`templates.ts`)
- Sem `--allow-all-tools`, o Copilot **não lê o codebase** — só responde ao texto colado
- Prompts do tipo "analise o projeto X" viram greeting genérico porque ele não tem acesso aos arquivos

### Causa 3 — stdout poluído sem parser

Com `--allow-all-tools`, o Copilot emite narração de tools no stdout:

```
● Read PLAN.md
● Search (glob) "src/**/*.ts"
...
Resposta final aqui
```

O bridge retorna **tudo** como `response`. Antigravity extrai só `plannerResponse`; Cursor parseia JSON.

### Causa 4 — Flags úteis da CLI não usadas

Flags disponíveis (`copilot --help`) que faltam na integração:

| Flag | Propósito |
|------|-----------|
| `--output-format json` | Parse estruturado (JSONL) |
| `--resume` / `--session-id` | Continuidade de sessão |
| `--allow-all-paths` | Acesso filesystem completo |
| `--allow-all` / `--yolo` | Permissões totais non-interactive |
| `--context long_context` | Prompts longos (pipeline) |
| `--enable-memory` | Memória entre turns |
| `--mode plan` / `--autopilot` | Tarefas complexas |
| `--reasoning-effort high` | Análises profundas |
| `--secret-env-vars` | Redação de secrets no output |

### Causa 5 — Sem probe de autenticação

`getCopilotCliStatus()` só verifica se o binário existe — **não** se `copilot login` foi feito. Cursor tem o mesmo gap (falhou com auth error).

### Causa 6 — Pipeline mal configurado para Copilot

`DEFAULT_PIPELINE_STEPS` usa Copilot no `review` com `agentic_mode: false`. Review de código **precisa** ler arquivos alterados — configuração atual transforma o Copilot em chatbot de texto.

### Causa 7 — Confusão semântica `agentic_mode`

No bridge, `agentic_mode` = "pode editar arquivos". Para Copilot, análise profunda também precisa de tools (read, grep, search). Falta separar:

- `allow_read_tools` — leitura/pesquisa (review, análise)
- `allow_write_tools` — edição/shell (implement, fix)

## Solução — Fase 9D: Copilot parity (v0.7.x) — modo LIGHT

> Com plano **Student**, Copilot é secundário. Correções abaixo aplicadas em modo light; `full` via `BRIDGE_COPILOT_PROFILE=full`.

| # | Entrega | Status |
|---|---------|--------|
| C1 | Parser JSONL | ✅ |
| C2 | read_tools vs write_tools | ✅ |
| C3 | Session resume | ✅ |
| C4 | Flags agentic completas | ⏳ (light: read-only ou chat) |
| C6 | Filtro stdout | ✅ |
| C7 | Probe auth | ✅ |
| C8 | Pipeline review → Antigravity | ✅ |

### Resultado esperado

Após 9D, Copilot deve:
- Responder análises arquiteturais com leitura real do repo
- Retornar resposta limpa (sem logs de tools)
- Suportar resume de sessão cross-delegation
- Aparecer no `bridge_status` com status de auth

---

## Ordem de execução recomendada

```
Sprint 1 — Copilot parity (9D) + auth probes
Sprint 2 — Workspace mutex + polling agentic (9A.1–9A.3)
Sprint 3 — Retry, DLQ, orphan recovery (9A.5, 9B.9)
Sprint 4 — Pipeline resume + Zod validation (9B.8, 9C.16)
Sprint 5 — HITL + cost telemetry (9C.14, 9B.12)
Sprint 6 — GitHub webhooks + Realtime worker (9C.19–20)
```

---

## Correções legadas (incorporadas na Fase 9)

- Modo `bridge` Antigravity instável → **9A.3**
- Polling agentic Antigravity → **9A.2**
- Listagem dinâmica Copilot/Cursor → **9C.18 + 9D.C9**
- Fallback headless `agy -p` → **9A.7**
- Copilot limitado → **9D (investigação acima)**
