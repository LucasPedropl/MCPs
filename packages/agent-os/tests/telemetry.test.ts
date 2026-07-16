import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractProxyMeta,
  resultLooksLikeError,
} from "../src/modules/telemetry/meta.js";
import { aggregateToolEvents } from "../src/modules/telemetry/usage-report.js";
import type { ToolEventRow } from "../src/modules/telemetry/types.js";

describe("extractProxyMeta", () => {
  it("extrai alias e child_tool de call_mcp_tool", () => {
    assert.deepEqual(
      extractProxyMeta("call_mcp_tool", {
        alias: "github",
        tool_name: "search_repositories",
        arguments: { query: "secret" },
      }),
      { alias: "github", child_tool: "search_repositories" },
    );
  });

  it("extrai child_tool de call_supabase_tool (tool_name e toolName)", () => {
    assert.deepEqual(
      extractProxyMeta("call_supabase_tool", { tool_name: "execute_sql" }),
      { child_tool: "execute_sql" },
    );
    assert.deepEqual(
      extractProxyMeta("call_supabase_tool", { toolName: "list_tables" }),
      { child_tool: "list_tables" },
    );
  });

  it("não extrai meta de tools comuns", () => {
    assert.deepEqual(
      extractProxyMeta("assemble_context", { intent: "x", workspace_path: "y" }),
      {},
    );
  });
});

describe("resultLooksLikeError", () => {
  it("detecta isError", () => {
    assert.equal(resultLooksLikeError({ isError: true }), true);
    assert.equal(resultLooksLikeError({ isError: false }), false);
    assert.equal(resultLooksLikeError({ content: [] }), false);
  });
});

describe("aggregateToolEvents", () => {
  const sinceIso = "2026-07-01T00:00:00.000Z";
  const untilIso = "2026-07-16T00:00:00.000Z";

  const events: ToolEventRow[] = [
    {
      tool_name: "assemble_context",
      host: "cursor",
      ok: true,
      duration_ms: 100,
      module: "context",
      meta: {},
      created_at: "2026-07-10T00:00:00.000Z",
    },
    {
      tool_name: "assemble_context",
      host: "cursor",
      ok: false,
      duration_ms: 200,
      module: "context",
      meta: {},
      created_at: "2026-07-11T00:00:00.000Z",
    },
    {
      tool_name: "call_mcp_tool",
      host: "antigravity",
      ok: true,
      duration_ms: 50,
      module: "mcp_hub",
      meta: { alias: "github", child_tool: "search_repositories" },
      created_at: "2026-07-12T00:00:00.000Z",
    },
  ];

  it("calcula top, coverage, never_used e proxies", () => {
    const report = aggregateToolEvents(events, {
      days: 30,
      sinceIso,
      untilIso,
      registeredTools: [
        "assemble_context",
        "call_mcp_tool",
        "remember",
        "mcp_usage_stats",
      ],
      hiddenTools: ["mcp_usage_stats"],
      limit: 10,
    });

    assert.equal(report.summary.total_calls, 3);
    assert.equal(report.summary.error_rate, 33.3);
    assert.equal(report.summary.registered_tools, 3);
    assert.equal(report.summary.touched_tools, 2);
    assert.deepEqual(report.never_used, ["remember"]);
    assert.equal(report.top_tools[0]?.tool_name, "assemble_context");
    assert.equal(report.top_tools[0]?.calls, 2);
    assert.equal(report.top_tools[0]?.avg_ms, 150);
    assert.equal(report.proxies.length, 1);
    assert.equal(report.proxies[0]?.alias, "github");
    assert.equal(report.summary.by_host[0]?.host, "cursor");
  });

  it("respeita hiddenTools no never_used", () => {
    const report = aggregateToolEvents([], {
      days: 7,
      sinceIso,
      untilIso,
      registeredTools: ["a", "b"],
      hiddenTools: ["b"],
    });
    assert.deepEqual(report.never_used, ["a"]);
    assert.equal(report.summary.registered_tools, 1);
  });
});
