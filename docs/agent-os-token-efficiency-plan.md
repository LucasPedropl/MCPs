# Plano: Eficiência de tokens no agent-os (paridade com instalação local)

> Handoff: este documento é o plano de implementação gerado por análise
> (2026-07-14), pronto para outra IA/sessão executar. Ver seção "Verificação" ao
> final para os testes de regressão que confirmam o ganho.

## Contexto

Testes reais (sessão Claude Code, 2026-07-14) compararam usar MCPs/skills via
agent-os vs. instalação nativa no Claude Code:

- **Custo fixo por sessão**: todo cliente que conecta o agent-os paga ~3.130
  chars de instructions + **~23.640 chars de descrições das 66 tools (~5,9K
  tokens)**, antes de qualquer chamada — sem contar os JSON schemas.
- **Custo por chamada**: `call_mcp_tool` devolveu **793.330 chars** crus no
  teste com o pdf-reader-mcp (sem guard nenhum); `resolve_skills` devolve
  `content_md` completo de até 3 skills mesmo com score zero (+34% vs. skill
  nativa no teste); `list_connected_mcps` lista servidores desconectados com
  arrays de toolNames.
- Objetivo do Pedro: agent-os ficar **igual ou mais barato** que instalar
  skill/MCP localmente em cada IA, sem inflar a contagem de tools (flatten de
  tools filhas foi avaliado e descartado — ver "Fora de escopo") e **sem perder
  precisão de ativação** (prioridade #1 dele: a tool/skill certa deve disparar
  no momento certo e ficar em silêncio quando irrelevante).

Utilitários reaproveitáveis já existem no código: `chunkText`/`estimateTokens`
(`packages/agent-os/src/modules/context/context-assembler.ts:11-22`),
middle-truncation
(`packages/agent-os/src/modules/orchestration/features/pipeline/context-compress.ts:21-72`).

**Árvore suja**: há mudanças não commitadas em `orchestration/*` no repo.
Trabalhar sobre o working tree atual, não sobre HEAD. Tocar só nos arquivos
listados abaixo.

---

## Etapa 1 — Guard de tamanho compartilhado + call_mcp_tool / call_supabase_tool (maior valor/esforço)

**1a.** `packages/shared/src/mcp-response.ts` — adicionar:

- `estimateTokens(text)` (len/4), `DEFAULT_GUARD_MAX_CHARS = 50_000`
- `truncateWithHint(text, { maxChars, hint, headRatio=0.8 })` — mantém head+tail
  com marcador:
  `[agent-os guard] TRUNCATED: result was {N} chars (~{T} tokens), cap is {M}. Kept head+tail; JSON may be cut mid-structure. Re-call with narrower arguments (filters, pagination, fields){hint}. Or pass max_chars to raise the cap.`
- `guardedJsonText(data, options)` — serializa **compacto**
  (`JSON.stringify(data)`, sem `null,2` — só isso economiza 10-30%);
  `maxChars<=0` desliga. Exportar em `packages/shared/src/index.ts`.
- `jsonText` atual fica intacto (tools de admin/export não podem truncar
  silenciosamente).

**1b.** `packages/agent-os/src/config/env.ts` — `getMcpResultMaxChars()`: env
`AGENT_OS_MCP_RESULT_MAX_CHARS`, default **25.000**, `<=0` desliga.

**1c.** `packages/agent-os/src/tools/mcp-hub-tools.ts:243-261` (`call_mcp_tool`)
— param opcional `max_chars` no schema; handler usa
`guardedJsonText(result, { maxChars: args.max_chars ?? getMcpResultMaxChars(), hint: '; use get_mcp_tool_schema {alias, tool_name} para achar params de paginação/filtro' })`.

**1d.** `packages/agent-os/src/modules/data/tools/hub-tools-unified.ts:106-122`
(`call_supabase_tool`) — mesmo tratamento; hint: "para execute_sql use
LIMIT/colunas específicas; para get_logs estreite o intervalo".

**1e.** `packages/agent-os/src/modules/data/tools/hub-tools-core.ts:44-61` —
remover o `jsonText` duplicado (re-exportar do `@mcps/shared`); `errorText`
local vira delegação preservando o `console.error("[supabase-hub]...")`. Nos
proxies (`registerProxyTools`, linhas 436-490), trocar para `guardedJsonText`
(servidor standalone, mas é o mesmo arquivo).

Verificado: `hub-tools-unified.ts:16` importa `jsonText`/`errorText` de
`./hub-tools-core.js` (o duplicado), não de `@mcps/shared` — ajustar os dois
lugares.

## Etapa 2 — resolve_skills slim + corte de relevância

**2a.** `packages/agent-os/src/modules/knowledge/knowledge-store.ts:140-160`:

- Extrair `scoreSkillsByIntent(skills, intent)` pura (exportada p/ teste),
  adicionar campo `score`.
- `resolveSkills` ganha `minScore` (default **1**): skills com score 0 não
  entram mais só para preencher o `limit`.
- `assembleContext` (caller interno) continua recebendo `content_md` completo —
  nada muda no shape de `SkillRecord`, `score` é aditivo.
  `renderSkillForHost`/`syncSkillsToHost` intocados (verificado: o caminho da
  tool nunca aplicou formato de host).

**2b.** `packages/agent-os/src/tools/knowledge-tools.ts:121-139`
(`resolve_skills`):

- Novos params: `include_content?: boolean`, `min_score?: number`.
- Default:
  `{ skills: [{name, description, version, scope, score}], hint: "Conteúdo completo: get_skill {name} ou include_content=true." }`
  — **sem content_md**.
- `include_content=true` devolve o array antigo (+score) para compat.

**2c.** Mesmo arquivo: `skill_admin list` ganha `include_content` (default
devolve name/description/`content_chars`); `get_skill` e `playbook get` trocam
para `guardedJsonText` com default 50K (rede de segurança, conteúdo completo é o
propósito deles).

**2d.** Atualizar entrada de `resolve_skills` no `tool-docs.ts`.

## Etapa 3 — list_connected_mcps slim

`packages/agent-os/src/tools/mcp-hub-tools.ts:40-64,152-168`:

- Novo shape:
  `{ total, connected: [{id, alias, transport, status, toolCount, last_health_at}], disconnected: ["alias1", ...], hint }`.
- **Desconectados viram strings de alias** (não somem: o hub é lazy —
  `upsertConnection` grava "disconnected" e só `updateToolCache` marca
  "connected"; esconder quebraria descoberta de MCP recém-registrado).
- `toolNames` sai do default (duplica `list_mcp_tools`); volta com
  `include_tool_names` (cap 25 + "+N more"). `include_disconnected=true` devolve
  objetos completos.
- Corrigir a entrada RETURNS errada de `list_connected_mcps` no tool-docs (hoje
  descreve campos de playbook).

## Etapa 4 — Descrições compactas + detalhe sob demanda (maior ganho fixo; sensível a ativação)

**4a.** Novo `packages/shared/src/tool-docs-util.ts`: `compactToolDoc(doc)` —
mantém linha-resumo (ou a linha `WHEN TO USE:` no formato da orquestração, que
não tem resumo) + linha `RETURNS:`; descarta `WHEN NOT/PARAMS/NOTES` (PARAMS é
redundante com o JSON schema que o cliente já recebe).

**4b.** `env.ts`: `getToolDocsMode()` — env `AGENT_OS_TOOL_DOCS`, `compact`
(default) | `full` (alavanca de rollback sem rebuild se a precisão de ativação
regredir).

**4c.** `packages/agent-os/src/tools/tool-docs.ts`: `describeAgentTool` vira
mode-aware; `getFullToolDoc(name)` para lookup; `COMPACT_TOOL_DOC_OVERRIDES`
**escrito à mão para os pares confundíveis** — o contraste do "WHEN NOT" migra
para a linha-resumo: `call_supabase_tool`↔`call_mcp_tool`,
`remember`↔`set_project_rule`, `recall_for_task`↔`assemble_context`,
`resolve_skills`↔`get_skill`, `list_projects`↔`list_agent_projects`,
`hub_status`↔`agent_os_status`, `connect_mcp`↔`install_mcp`, `switch_project`
(manter "OBRIGATÓRIO antes de operar o banco"). Corrigir bloco duplicado de
`route_for_pedro` (linhas ~335-341).

**4d.** `packages/agent-os/src/modules/orchestration/tools/tool-docs.ts`: mesmo
tratamento em `describeTool` + overrides para
`delegate_task`/`delegate_and_wait`/`delegate_async`/`run_pipeline`/`get_job_status`/`bridge_status`.
**Atenção: arquivo tem mudanças não commitadas — rebase sobre o working tree.**

**4e.** `packages/agent-os/src/tools/core-tools.ts:59-73`: `get_usage_guide`
ganha `tool_name?` — devolve o doc completo (WHEN TO USE/WHEN
NOT/RETURNS/PARAMS/NOTES) da tool pedida; contagem de tools não muda.
`agent_os_status` passa a expor `toolDocsMode`, `mcpResultMaxChars`,
`hiddenTools`.

**4f.** `instructions.ts` + `INSTRUCTIONS.md` (espelho): nova linha na árvore de
decisão — "Detalhes de uma tool → get_usage_guide tool_name=..." e documentar os
4 envs novos na seção Módulos.

**Economia estimada**: descrições ~23,6K → ~10,8K chars (**~3,2K tokens/sessão,
-55%**). Instructions (3,1K) ficam intactas — a árvore de decisão é a espinha
dorsal da ativação.

## Etapa 5 — Filtro opcional por tool (surface trimming por cliente)

**5a.** `env.ts`: `getToolFilter()` — envs `AGENT_OS_TOOLS_ALLOW` /
`AGENT_OS_TOOLS_DENY` (csv; allow não-vazio = só esses; deny remove depois;
default sem filtro).

**5b.** Novo `packages/agent-os/src/tools/tool-filter.ts`:
`applyToolFilter(server)` — monkey-patch de **`server.registerTool` E
`server.tool`** (orquestração usa a API legada — 20 ocorrências em 8 arquivos,
verificado: `webhooks.ts`, `usage-guide.ts`, `parallel.ts`, `sessions.ts`,
`observability.ts`, `pipeline.ts`, `jobs.ts`, `bridge.ts`) antes de qualquer
registro; nome oculto → stub inerte (nenhum caller usa o retorno, verificado) +
log stderr. `ALWAYS_VISIBLE = {agent_os_status, get_usage_guide}` nunca oculta
(o guide é o lookup de docs sob demanda). Sem filtro setado → não faz patch.

**5c.** `server.ts:41-61`: chamar `applyToolFilter` logo após construir o
server. Permite ex.: `AGENT_OS_TOOLS_DENY=rollback_task,delete_project,webhooks`
no mcp.json de cada cliente, sem novos módulos nem listChanged.

## Etapa 6 — Testes

`packages/agent-os/tests/agent-os-improvements.test.ts` — **só apendar
`describe` novos** (arquivo tem mudanças não commitadas). Estilo existente:
`node:test` + `assert/strict`; padrão save/restore de env já existe nas linhas
~91-103.

- `guardedJsonText/truncateWithHint`: passthrough sob o cap; acima do cap contém
  marcador+originalChars+hint e tamanho ≈ cap; `maxChars=0` desliga;
  serialização compacta.
- `scoreSkillsByIntent/minScore`: skill relevante ranqueada com score≥1; intent
  sem sentido → vazio por default; `minScore=0` restaura comportamento antigo;
  `limit` respeitado.
- `summarizeConnections` (exportar): default sem toolNames + desconectados como
  strings; `include_tool_names` com cap 25; `include_disconnected` com objetos.
- `compactToolDoc`: formato principal (resumo+RETURNS) e formato orquestração
  (WHEN TO USE+RETURNS); `describeAgentTool` honra o env.
- `isToolHidden`: deny oculta; allow-list oculta o resto; deny vence allow;
  ALWAYS_VISIBLE nunca oculta; sem filtro → nada oculto.

Rodar: `npm test` dentro de `packages/agent-os`
(`tsx --test tests/**/*.test.ts`).

---

## Compatibilidade

- `resolve_skills` muda de shape (`SkillRecord[]` → `{skills, hint}`);
  `include_content=true` = shape antigo. `list_connected_mcps` muda de shape;
  fluxo documentado (`list_connected_mcps → list_mcp_tools → call_mcp_tool`)
  continua válido.
- Guard: escape por chamada (`max_chars`) e por env (`=0`). JSON truncado pode
  ser inválido — o marcador avisa explicitamente para re-chamar em vez de
  parsear.
- Clientes cacheiam `tools/list` por conexão: **todo cliente precisa reconectar
  o MCP após deploy**. Rollback de docs: `AGENT_OS_TOOL_DOCS=full` por cliente,
  sem rebuild.
- Envs novos: `AGENT_OS_MCP_RESULT_MAX_CHARS` (25000), `AGENT_OS_TOOL_DOCS`
  (compact), `AGENT_OS_TOOLS_ALLOW`/`_DENY` (unset).
- `packages/shared` também é consumido pelo openapi-engine — adições são
  puramente aditivas.

## Verificação

1. `npm run typecheck` + `npm test` em `packages/agent-os`; build do monorepo
   cobre `packages/shared`.
2. `npm run build` em `packages/agent-os` (clientes apontam para
   `dist/index.js`).
3. Reconectar o agent-os nos clientes (Claude Code: `/mcp` reconnect;
   Cursor/Antigravity: reload).
4. **Regressão do caso PDF (793K chars)**:
   `call_mcp_tool {alias: "pdf-reader", tool_name: "read_pdf", arguments: {sources:[{path: "C:\\codigo\\pessoal\\MCPs\\docs\\Projeto App Cashback de Gás (1).pdf"}]}}`
   → esperado ≤ ~25,3K chars terminando no marcador TRUNCATED citando ~793K
   originais. Com `max_chars: 100000` o cap sobe; com env `=0` volta o
   passthrough.
5. **resolve_skills**: intent "supabase migration" → `{skills, hint}` sem
   content_md; `include_content:true` → markdown idêntico ao `get_skill`; intent
   "zzz qqq" → `skills: []`. Depois `assemble_context` com intent relevante →
   chunks de skill ainda presentes (caminho interno intacto).
6. **Medição do custo fixo**: script no scratchpad com
   `@modelcontextprotocol/sdk` (Client + StdioClientTransport) contra
   `dist/index.js`: `client.listTools()` → `JSON.stringify(tools).length`, uma
   vez com `AGENT_OS_TOOL_DOCS=full` e uma com `compact` — esperado ~13K chars
   (~3,2K tokens) de redução.
7. **Smoke de precisão de ativação** (prioridade #1 do Pedro): 5 prompts canário
   em modo compact — "listar tabelas do supabase" → `call_supabase_tool` (não
   `call_mcp_tool`); "ler PDF via MCP" → `call_mcp_tool`; "nunca tocar na pasta
   API" → `set_project_rule` (não `remember`); "o que sei desta tarefa" →
   `recall_for_task`; "qual skill se aplica" → `resolve_skills`. Erro em algum →
   ajustar o override daquela tool (ou `AGENT_OS_TOOL_DOCS=full` naquele
   cliente).

## Fora de escopo (decidido com Pedro)

- **Flatten de tools filhas no hub** (registrar cada tool de MCP conectado como
  tool nativa do agent-os): descartado porque o hub carrega o portfólio inteiro
  de MCPs do Pedro entre projetos (github, pdf-reader, vercel, supabase, + 4
  aliases openapi de clientes diferentes) — flatten inflaria a lista de tools em
  **toda** sessão, mesmo em projetos que não usam aquele MCP. Se algum dia for
  revisitado, precisa ser escopado por projeto ativo (via
  `bootstrap_project`/`switch_project`), não global.
- **Credencial quebrada do GitHub no hub** (`call_mcp_tool` retornando
  `Authentication Failed: Bad credentials` no teste do alias `github`) —
  ignorada por enquanto, por decisão do Pedro. Fica pendente para quando ele
  quiser tratar.

## Arquivos críticos

- `packages/shared/src/mcp-response.ts` (guard helper + exports; Etapa 1)
- `packages/agent-os/src/tools/mcp-hub-tools.ts` (guard do call_mcp_tool + slim
  do list_connected_mcps; Etapas 1, 3)
- `packages/agent-os/src/tools/tool-docs.ts` (descrições compactas + overrides +
  lookup completo; Etapa 4)
- `packages/agent-os/src/modules/knowledge/knowledge-store.ts` (ranking com
  corte de relevância; Etapa 2)
- `packages/agent-os/src/config/env.ts` (resolução de todos os envs novos;
  Etapas 1, 4, 5)
