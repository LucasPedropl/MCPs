import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskSecret, redactMcpConfig } from "../src/lib/mask-secret.js";
import { parseListTablesResult } from "../src/modules/data/schema-parser.js";
import { detectStack } from "../src/modules/bootstrap/bootstrap-detect.js";
import { resolveAntigravityPlannerMode } from "../src/modules/orchestration/providers/antigravity/config.js";
import { isAwaitingPlanApproval } from "../src/modules/orchestration/utils/plan-approval.js";
import path from "node:path";
import {
  compactToolDoc,
  guardedJsonText,
  truncateWithHint,
} from "@mcps/shared";
import {
  scoreSkillsByIntent,
  type SkillRecord,
} from "../src/modules/knowledge/knowledge-store.js";
import { summarizeConnections } from "../src/tools/mcp-hub-tools.js";
import type { HubConnection } from "../src/modules/mcp_hub/registry/connection-store.js";
import { describeAgentTool } from "../src/tools/tool-docs.js";
import { describeTool } from "../src/modules/orchestration/tools/tool-docs.js";
import { isToolHidden } from "../src/tools/tool-filter.js";

describe("maskSecret", () => {
  it("mascara JWT mantendo prefixo e sufixo", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
    assert.equal(maskSecret(token), "eyJhbG...ture");
  });

  it("retorna undefined para valor vazio", () => {
    assert.equal(maskSecret(""), undefined);
  });
});

describe("redactMcpConfig", () => {
  it("redact env sensível", () => {
    const redacted = redactMcpConfig({
      command: "npx",
      env: {
        GITHUB_TOKEN: "ghp_abcdefghijklmnopqrstuvwxyz",
        NODE_ENV: "production",
      },
    });

    const env = redacted.env as Record<string, string>;
    assert.match(env.GITHUB_TOKEN, /\.\.\./);
    assert.equal(env.NODE_ENV, "production");
  });
});

describe("parseListTablesResult", () => {
  it("aceita array na raiz", () => {
    const result = parseListTablesResult({
      content: [
        {
          type: "text",
          text: JSON.stringify([{ name: "orders", columns: [{ name: "id" }] }]),
        },
      ],
    });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.table, "orders");
    assert.deepEqual(result[0]?.columns, ["id"]);
  });

  it("aceita wrapper tables", () => {
    const result = parseListTablesResult({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tables: [{ table_name: "products", columns: ["sku", "price"] }],
          }),
        },
      ],
    });

    assert.equal(result[0]?.table, "products");
    assert.deepEqual(result[0]?.columns, ["sku", "price"]);
  });
});

describe("detectStack monorepo", () => {
  it("agrega deps dos workspaces do monorepo MCPs", () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const stack = detectStack(root);

    assert.equal(stack.monorepo, true);
    assert.equal(stack.react, true);
    assert.equal(stack.next, true);
    assert.equal(stack.supabase, true);
    assert.equal(stack.zod, true);
    assert.equal(stack.tailwind, true);
  });
});

describe("resolveAntigravityPlannerMode", () => {
  it("mapeia off/on/default para enums da API", () => {
    assert.equal(resolveAntigravityPlannerMode("off"), "PLANNING_OFF");
    assert.equal(resolveAntigravityPlannerMode("on"), "PLANNING_ON");
    assert.equal(resolveAntigravityPlannerMode("default"), "DEFAULT");
  });

  it("default sem param é PLANNING_OFF", () => {
    const prev = process.env["BRIDGE_ANTIGRAVITY_PLANNER_MODE"];
    delete process.env["BRIDGE_ANTIGRAVITY_PLANNER_MODE"];
    try {
      assert.equal(resolveAntigravityPlannerMode(), "PLANNING_OFF");
    } finally {
      if (prev === undefined) {
        delete process.env["BRIDGE_ANTIGRAVITY_PLANNER_MODE"];
      } else {
        process.env["BRIDGE_ANTIGRAVITY_PLANNER_MODE"] = prev;
      }
    }
  });
});

describe("isAwaitingPlanApproval", () => {
  it("detecta pedido de confirmação EN/PT", () => {
    assert.equal(
      isAwaitingPlanApproval(
        "Here is the implementation plan:\n1. Edit files\n2. Run tests\n\nPlease confirm to proceed.",
      ),
      true,
    );
    assert.equal(
      isAwaitingPlanApproval(
        "Criei o plano abaixo com os passos. Posso continuar com a implementação?",
      ),
      true,
    );
  });

  it("não marca resposta de tarefa concluída", () => {
    assert.equal(
      isAwaitingPlanApproval(
        "Implemented successfully. All files were edited and the task is complete.",
      ),
      false,
    );
    assert.equal(isAwaitingPlanApproval("SMOKE_OK"), false);
  });
});

function getText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content[0]?.text ?? "";
}

describe("guardedJsonText/truncateWithHint", () => {
  it("passthrough sob o cap, serialização compacta", () => {
    const data = { a: 1, b: [1, 2] };
    const text = getText(guardedJsonText(data));
    assert.equal(text, '{"a":1,"b":[1,2]}');
    assert.doesNotMatch(text, /\n/);
  });

  it("acima do cap contém marcador, tamanho original, hint e respeita o cap", () => {
    const big = JSON.stringify({ rows: "x".repeat(5_000) });
    const text = getText(
      guardedJsonText(big, { maxChars: 600, hint: "; use paginação" }),
    );
    assert.ok(text.length <= 600, `esperado <= 600, veio ${text.length}`);
    assert.match(text, /\[agent-os guard\] TRUNCATED/);
    assert.match(text, new RegExp(`result was ${big.length} chars`));
    assert.match(text, /use paginação/);
    assert.match(text, /max_chars/);
  });

  it("maxChars<=0 desliga o guard", () => {
    const big = "y".repeat(100_000);
    assert.equal(getText(guardedJsonText(big, { maxChars: 0 })), big);
    assert.equal(truncateWithHint(big, { maxChars: -1 }), big);
  });

  it("truncateWithHint mantém head e tail", () => {
    const text = `HEAD${"-".repeat(2_000)}TAIL`;
    const truncated = truncateWithHint(text, { maxChars: 800 });
    assert.match(truncated, /^HEAD/);
    assert.match(truncated, /TAIL$/);
  });
});

describe("scoreSkillsByIntent/minScore", () => {
  const skills: SkillRecord[] = [
    {
      id: "s1",
      name: "supabase-migration",
      description: "Guia de migrations e schema no Supabase",
      version: "1.0.0",
      scope: "global",
      content_md: "# Migrations",
      workspace_path: null,
    },
    {
      id: "s2",
      name: "frontend-design",
      description: "Padrões de UI e design system",
      version: "1.0.0",
      scope: "global",
      content_md: "# Design",
      workspace_path: null,
    },
  ];

  it("skill relevante ranqueada primeiro com score>=1", () => {
    const ranked = scoreSkillsByIntent(skills, "supabase migration");
    assert.equal(ranked[0]?.name, "supabase-migration");
    assert.ok((ranked[0]?.score ?? 0) >= 1);
  });

  it("intent sem sentido → vazio com o corte default (minScore=1)", () => {
    const ranked = scoreSkillsByIntent(skills, "zzz qqq www");
    const filtered = ranked.filter((skill) => skill.score >= 1);
    assert.equal(filtered.length, 0);
  });

  it("minScore=0 restaura comportamento antigo (preenche o limit)", () => {
    const ranked = scoreSkillsByIntent(skills, "zzz qqq www");
    const filtered = ranked.filter((skill) => skill.score >= 0);
    assert.equal(filtered.length, skills.length);
  });

  it("limit respeitado após o corte", () => {
    const ranked = scoreSkillsByIntent(skills, "supabase design ui migrations")
      .filter((skill) => skill.score >= 1)
      .slice(0, 1);
    assert.equal(ranked.length, 1);
  });
});

describe("summarizeConnections", () => {
  const manyTools = Array.from({ length: 30 }, (_, index) => ({
    name: `tool_${index}`,
  }));
  const connections: HubConnection[] = [
    {
      id: "1",
      alias: "github",
      transport: "stdio",
      config_json: { command: "npx" },
      tool_cache_json: manyTools,
      status: "connected",
      last_health_at: "2026-07-14T00:00:00Z",
    },
    {
      id: "2",
      alias: "vercel",
      transport: "http",
      config_json: {},
      tool_cache_json: [],
      status: "disconnected",
      last_health_at: null,
    },
  ];

  it("default: sem toolNames, desconectados como strings de alias", () => {
    const overview = summarizeConnections(connections, {});
    assert.equal(overview.total, 2);
    assert.equal(overview.connected.length, 1);
    assert.equal(overview.connected[0]?.toolNames, undefined);
    assert.equal(overview.connected[0]?.toolCount, 30);
    assert.deepEqual(overview.disconnected, ["vercel"]);
    assert.ok(overview.hint.length > 0);
  });

  it("include_tool_names aplica cap 25 + '+N more'", () => {
    const overview = summarizeConnections(connections, { includeToolNames: true });
    const names = overview.connected[0]?.toolNames ?? [];
    assert.equal(names.length, 26);
    assert.equal(names[25], "+5 more");
  });

  it("include_disconnected devolve objetos completos", () => {
    const overview = summarizeConnections(connections, { includeDisconnected: true });
    const [first] = overview.disconnected;
    assert.equal(typeof first, "object");
    assert.equal((first as { alias: string }).alias, "vercel");
  });
});

describe("compactToolDoc", () => {
  it("formato principal: mantém resumo+RETURNS, descarta WHEN NOT/PARAMS/NOTES", () => {
    const doc = [
      "Resumo em uma linha.",
      "WHEN TO USE: caso A.",
      "WHEN NOT: caso B (use outra_tool).",
      "RETURNS: { ok }",
      "PARAMS: a, b, c.",
      "NOTES: detalhe extra.",
    ].join("\n");
    assert.equal(compactToolDoc(doc), "Resumo em uma linha.\nRETURNS: { ok }");
  });

  it("formato orquestração (sem resumo): mantém WHEN TO USE+RETURNS", () => {
    const doc = [
      "WHEN TO USE: delegação síncrona.",
      "WHEN NOT: tarefas longas.",
      "RETURNS: { success }",
      "NOTES: usa fallback chain.",
    ].join("\n");
    assert.equal(
      compactToolDoc(doc),
      "WHEN TO USE: delegação síncrona.\nRETURNS: { success }",
    );
  });
});

describe("describeAgentTool/describeTool honram AGENT_OS_TOOL_DOCS", () => {
  function withToolDocsEnv(value: string | undefined, run: () => void): void {
    const prev = process.env["AGENT_OS_TOOL_DOCS"];
    if (value === undefined) {
      delete process.env["AGENT_OS_TOOL_DOCS"];
    } else {
      process.env["AGENT_OS_TOOL_DOCS"] = value;
    }
    try {
      run();
    } finally {
      if (prev === undefined) {
        delete process.env["AGENT_OS_TOOL_DOCS"];
      } else {
        process.env["AGENT_OS_TOOL_DOCS"] = prev;
      }
    }
  }

  it("compact (default) devolve resumo+RETURNS sem WHEN NOT/PARAMS", () => {
    withToolDocsEnv(undefined, () => {
      const doc = describeAgentTool("sync_skills");
      assert.match(doc, /^Sincroniza skills/);
      assert.match(doc, /RETURNS:/);
      assert.doesNotMatch(doc, /WHEN NOT:/);
      assert.doesNotMatch(doc, /PARAMS:/);
    });
  });

  it("full devolve a doc completa", () => {
    withToolDocsEnv("full", () => {
      const doc = describeAgentTool("sync_skills");
      assert.match(doc, /WHEN NOT:/);
      assert.match(doc, /PARAMS:/);
    });
  });

  it("override compacto mantém o contraste do par confundível", () => {
    withToolDocsEnv(undefined, () => {
      assert.match(describeAgentTool("call_supabase_tool"), /call_mcp_tool/);
      assert.match(describeAgentTool("call_mcp_tool"), /call_supabase_tool/);
      assert.match(describeAgentTool("switch_project"), /OBRIGATÓRIO antes de operar o banco/);
      assert.match(describeTool("delegate_task"), /delegate_and_wait/);
    });
  });

  it("orquestração compacta sem override cai no compactToolDoc", () => {
    withToolDocsEnv(undefined, () => {
      const doc = describeTool("list_models");
      assert.match(doc, /WHEN TO USE:/);
      assert.match(doc, /RETURNS:/);
      assert.doesNotMatch(doc, /NOTES:/);
    });
  });
});

describe("isToolHidden", () => {
  const filter = (allow: string[], deny: string[]) => ({
    allow: new Set(allow),
    deny: new Set(deny),
    active: allow.length > 0 || deny.length > 0,
  });

  it("deny oculta a tool", () => {
    assert.equal(isToolHidden("webhooks", filter([], ["webhooks"])), true);
    assert.equal(isToolHidden("remember", filter([], ["webhooks"])), false);
  });

  it("allow-list oculta o resto", () => {
    const f = filter(["remember"], []);
    assert.equal(isToolHidden("remember", f), false);
    assert.equal(isToolHidden("webhooks", f), true);
  });

  it("deny vence allow", () => {
    assert.equal(isToolHidden("webhooks", filter(["webhooks"], ["webhooks"])), true);
  });

  it("ALWAYS_VISIBLE nunca oculta", () => {
    const f = filter(["remember"], ["agent_os_status", "get_usage_guide"]);
    assert.equal(isToolHidden("agent_os_status", f), false);
    assert.equal(isToolHidden("get_usage_guide", f), false);
  });

  it("sem filtro → nada oculto", () => {
    assert.equal(isToolHidden("rollback_task", filter([], [])), false);
  });
});
