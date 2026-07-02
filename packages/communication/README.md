Monorepo: instale e faça build na **raiz** (`npm install && npm run build`). Ver [README.md](../../README.md).

# MCPcomunication

Hub MCP local para delegar tarefas entre **Cursor**, **Antigravity** e (futuro) **GitHub Copilot**.

## Fase atual

### Fase 1 — Cursor → Antigravity ✅
- `bridge_status`, `list_models`, `delegate_task`, `delegate_and_wait`
- Auto-launch da IDE Antigravity no workspace correto
- Modo `subagent` (background)

### Fase 2 — Antigravity → Cursor ✅ (parcial)
- `delegate_task` com `provider: "cursor"` via Cursor Agent CLI
- MCP registrado no Antigravity (`~/.gemini/antigravity-ide/mcp_config.json`)
- Requer `agent login` no terminal se o CLI retornar "Not logged in"

### Fase 3 — Copilot CLI ✅ (parcial)
- `delegate_task` com `provider: "copilot"` via GitHub Copilot CLI
- Requer `copilot` instalado e autenticado (`COPILOT_GITHUB_TOKEN` ou login)
- Modelos: `claude-sonnet-4.6`, `gpt-5.3-codex`, `claude-haiku-4.5`

### Pendente
- Modo `parallel` e correção do modo `bridge`

## Requisitos

- Node.js >= 22
- Antigravity IDE **ou** launcher detectado automaticamente (`antigravity-ide.cmd`)
- `BRIDGE_DEFAULT_CWD` apontando para o workspace desejado no `mcp.json`

### Precisa instalar o `agy`?

**Não.** O `agy` é o CLI de terminal do Google (substituto do Gemini CLI) — é **diferente** do launcher da IDE.

Para o auto-launch, o bridge usa o **`antigravity-ide.cmd`**, que já vem com a instalação da IDE em:

```
%LOCALAPPDATA%\Programs\Antigravity IDE\bin\antigravity-ide.cmd
```

Opcionalmente, você pode instalar o comando no PATH pela IDE:
**Command Palette → `Shell Command: Install 'antigravity-ide' command in PATH`**

## Workspace — como o Antigravity sabe qual pasta abrir?

O MCP **não adivinha** o projeto. Ele usa esta ordem:

1. `BRIDGE_DEFAULT_CWD` no `mcp.json` (recomendado)
2. `ANTIGRAVITY_WORKSPACE` se for um caminho de pasta
3. `process.cwd()` do servidor MCP

Quando nenhuma instância do Antigravity corresponde a esse caminho, o bridge executa:

```bash
agy "C:/caminho/do/workspace"
# ou, se já existem outras janelas abertas:
agy --new-window "C:/caminho/do/workspace"
```

Depois aguarda o `language_server` subir **somente** na instância que bate com o workspace alvo.

**Exemplo:** com `BRIDGE_DEFAULT_CWD` = `C:/codigo/pessoal/MCPcomunication`, o Antigravity abre exatamente nessa pasta — mesmo que você tenha outros projetos abertos em outras janelas.

## Instalação

```bash
npm install
npm run build
```

### Desenvolvimento com hot-reload (recomendado)

Em vez de `node dist/index.js`, use no `mcp.json`:

```json
"command": "npm",
"args": ["run", "mcp:dev"],
"cwd": "C:/codigo/pessoal/MCPcomunication",
"env": {
  "BRIDGE_HOT_RELOAD": "1",
  "BRIDGE_COPILOT_PROFILE": "light"
}
```

Alternativa com build: terminal com `npm run build:watch` + MCP apontando para `node dist/index.js` com `BRIDGE_HOT_RELOAD=1`.

## Configuração no Cursor

Adicione em `.cursor/mcp.json` (ou config global):

```json
{
  "mcpServers": {
    "ide-bridge": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPcomunication/dist/index.js"],
      "env": {
        "BRIDGE_DEFAULT_CWD": "C:/codigo/pessoal/MCPcomunication"
      }
    }
  }
}
```

## Configuração no Antigravity

Arquivo `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "ide-bridge": {
      "command": "node",
      "args": ["C:/codigo/pessoal/MCPcomunication/dist/index.js"],
      "env": {
        "BRIDGE_DEFAULT_CWD": "C:/codigo/pessoal/MCPcomunication"
      }
    }
  }
}
```

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `BRIDGE_DEFAULT_CWD` | **Workspace alvo** — pasta que o Antigravity deve abrir/usar |
| `BRIDGE_COPILOT_PROFILE` | `light` (padrão, student) ou `full` |
| `BRIDGE_HOT_RELOAD` | `1` — reinicia MCP ao salvar (dev) |
| `BRIDGE_AUTO_MERGE` | `1` (padrão) — merge automático ao fim de delegação agentic isolada |
| `BRIDGE_MERGE_STRATEGY` | `smart` (padrão), `theirs` ou `ours` — resolução de conflitos no merge |
| `BRIDGE_ISOLATE_WORKSPACE` | `1` (padrão) — worktrees isolados para delegações agentic |
| `BRIDGE_ANTIGRAVITY_PARALLEL` | `1` (padrão) — paralelismo no mesmo repo (subagent + worktree agentic) |
| `BRIDGE_ANTIGRAVITY_MAX_CONCURRENT` | `4` — cascades subagent simultâneos |
| `BRIDGE_ANTIGRAVITY_HEADLESS_CLI` | Caminho do `agy.exe` para agentic paralelo headless |
| `BRIDGE_ANTIGRAVITY_LAUNCHER` | Caminho manual para `agy.exe` ou `Antigravity.exe` |
| `BRIDGE_LAUNCH_TIMEOUT_MS` | Tempo máximo aguardando a IDE subir (padrão: 45000) |
| `ANTIGRAVITY_WORKSPACE` | Filtro alternativo por nome/id do workspace |
| `ANTIGRAVITY_PORT` | Porta manual do language server |
| `ANTIGRAVITY_CSRF_TOKEN` | CSRF token manual |

## Modelos Antigravity (exemplos)

| ID | Modelo |
|----|--------|
| `MODEL_PLACEHOLDER_M16` | Gemini 3.1 Pro (High) — padrão |
| `MODEL_PLACEHOLDER_M20` | Gemini 3.5 Flash (Medium) |
| `MODEL_PLACEHOLDER_M35` | Claude Sonnet 4.6 (Thinking) |
| `MODEL_PLACEHOLDER_M26` | Claude Opus 4.6 (Thinking) |

## Modos de delegação (Antigravity)

| Modo | Chat visível na IDE | Uso recomendado |
|------|---------------------|-----------------|
| `subagent` (padrão) | Não — cascade isolada | Delegar do Cursor sem poluir sua conversa no Antigravity |
| `bridge` | Sim — anexa ao chat aberto do workspace | Quando você quer acompanhar na janela do Antigravity |

O desempenho é o mesmo nos dois modos. A diferença é só visual/UX.

## Antigravity precisa estar aberto?

**Não necessariamente**, a partir do auto-launch:

- Se o Antigravity **já está aberto** no workspace certo → usa direto
- Se está **fechado** ou aberto em **outro projeto** → o MCP abre (ou abre nova janela) no workspace de `BRIDGE_DEFAULT_CWD`
- A janela pode ficar **minimizada** depois de abrir
- Requer o comando `agy` no PATH ou `BRIDGE_ANTIGRAVITY_LAUNCHER` configurado

Para desativar auto-launch: `BRIDGE_ANTIGRAVITY_AUTO_LAUNCH=false`

Fallback via CLI headless (`agy -p`) sem IDE está previsto para fase futura.

- Fase 2: provider Cursor (`cursor-agent` CLI / `@cursor/sdk`)
- Fase 3: provider Copilot (`@github/copilot-sdk`)
- Fase 4: modos `bridge` e `parallel` com job store
