import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { unwrapMcpResult } from "@mcps/shared";
import { matchesAction, matchesPattern } from "../src/modules/policy/policy-store.js";
import { pgrestQuote } from "../src/features/supabase-client.js";
import {
  inheritedEnv,
  interpolateEnvValue,
} from "../src/modules/mcp_hub/child-client/child-mcp-client.js";
import {
  classifyIntent,
  suggestProviderForIntent,
} from "../src/modules/orchestration/routing/heuristics.js";
import { classifyPrompt } from "../src/modules/orchestration/features/parallel/router.js";
import {
  finalizeDelegationWorkspace,
  preserveDelegationWorkspace,
} from "../src/modules/orchestration/features/workspace/git-merge.js";
import type { DelegationWorkspace } from "../src/modules/orchestration/features/workspace/git-worktree.js";

// ─── policy matching ─────────────────────────────────────────────────────────

describe("matchesPattern (sem substring permissivo)", () => {
  it("glob casa paths com case-insensitive", () => {
    assert.equal(matchesPattern("apps/web/api/route.ts", "apps/web/api/**"), true);
    assert.equal(matchesPattern("APPS\\WEB\\API\\route.ts", "apps/web/api/**"), true);
    assert.equal(matchesPattern("apps/web/ui/button.tsx", "apps/web/api/**"), false);
  });

  it("texto simples NÃO casa por substring (rm vs format)", () => {
    assert.equal(matchesPattern("npm run format", "rm"), false);
  });

  it("texto simples casa por prefixo com fronteira de palavra", () => {
    assert.equal(matchesPattern("rm -rf x", "rm"), true);
    assert.equal(matchesPattern("rmdir foo", "rm"), false);
    assert.equal(matchesPattern("rm", "rm"), true);
  });

  it("regex só com delimitadores explícitos /.../", () => {
    assert.equal(matchesPattern("drop table users", "/drop\\s+table/"), true);
    assert.equal(matchesPattern("drop the mic", "/drop\\s+table/"), false);
    // sem delimitador, metacaracteres são texto literal
    assert.equal(matchesPattern("abc", "a.c"), false);
  });

  it("wildcard e vazio casam tudo", () => {
    assert.equal(matchesPattern("qualquer", "*"), true);
    assert.equal(matchesPattern("qualquer", ""), true);
  });
});

describe("matchesAction (taxonomia tipo:valor)", () => {
  it("tipo tem que bater", () => {
    assert.equal(matchesAction("shell:rm -rf x", "shell:rm"), true);
    assert.equal(matchesAction("write:src/index.ts", "shell:rm"), false);
  });

  it("valor usa matchesPattern", () => {
    assert.equal(matchesAction("write:apps/web/api/x.ts", "write:apps/web/api/**"), true);
    assert.equal(matchesAction("shell:npm run format", "shell:rm"), false);
  });
});

// ─── pgrestQuote ─────────────────────────────────────────────────────────────

describe("pgrestQuote", () => {
  it("quota valores com vírgula/parênteses para filtros .or()", () => {
    assert.equal(pgrestQuote("C:/foo,bar(1)"), '"C:/foo,bar(1)"');
  });

  it("escapa aspas e backslashes internos", () => {
    assert.equal(pgrestQuote('a"b'), '"a\\"b"');
    assert.equal(pgrestQuote("C:\\dir"), '"C:\\\\dir"');
  });
});

// ─── interpolação de env dos presets ────────────────────────────────────────

describe("interpolateEnvValue", () => {
  it("resolve ${VAR} do process.env", () => {
    process.env["AGENT_OS_TEST_TOKEN_X"] = "tok-123";
    try {
      assert.equal(interpolateEnvValue("${AGENT_OS_TEST_TOKEN_X}"), "tok-123");
      assert.equal(
        interpolateEnvValue("Bearer ${AGENT_OS_TEST_TOKEN_X}"),
        "Bearer tok-123",
      );
    } finally {
      delete process.env["AGENT_OS_TEST_TOKEN_X"];
    }
  });

  it("retorna undefined quando a VAR não existe (caller descarta a entrada)", () => {
    assert.equal(interpolateEnvValue("${AGENT_OS_VAR_INEXISTENTE_ZZZ}"), undefined);
  });

  it("string sem placeholder passa intacta", () => {
    assert.equal(interpolateEnvValue("plain-value"), "plain-value");
  });
});

describe("inheritedEnv", () => {
  it("filtra segredos do agent-os e mantém o resto", () => {
    process.env["AGENT_OS_SUPABASE_KEY"] = "secreta";
    process.env["BRIDGE_SUPABASE_KEY"] = "secreta2";
    process.env["AGENT_OS_TEST_PLAIN"] = "ok";
    try {
      const env = inheritedEnv();
      assert.equal(env["AGENT_OS_SUPABASE_KEY"], undefined);
      assert.equal(env["BRIDGE_SUPABASE_KEY"], undefined);
      assert.equal(env["AGENT_OS_TEST_PLAIN"], "ok");
    } finally {
      delete process.env["AGENT_OS_SUPABASE_KEY"];
      delete process.env["BRIDGE_SUPABASE_KEY"];
      delete process.env["AGENT_OS_TEST_PLAIN"];
    }
  });
});

// ─── heurística de roteamento única ─────────────────────────────────────────

describe("routing heuristics", () => {
  it("classifica categorias principais", () => {
    assert.equal(classifyIntent("criar migration com RLS"), "database");
    assert.equal(classifyIntent("code review do módulo x"), "review");
    assert.equal(classifyIntent("implementar feature de export"), "implement");
    assert.equal(classifyIntent("fix typo no README"), "small_fix");
    assert.equal(classifyIntent("explicar como funciona o cache"), "explain");
    assert.equal(classifyIntent("bom dia"), "general");
  });

  it("sugere provider coerente", () => {
    assert.equal(suggestProviderForIntent("migration sql"), "cursor");
    assert.equal(suggestProviderForIntent("implementar feature grande"), "antigravity");
    assert.equal(suggestProviderForIntent("bom dia"), undefined);
  });

  it("classifyPrompt (parallel) usa a mesma heurística", () => {
    assert.equal(classifyPrompt("audit de segurança"), "review");
    assert.equal(classifyPrompt("implementar endpoint"), "implement");
    assert.equal(classifyPrompt("o que é RLS"), "implement"); // database vence explain
    assert.equal(classifyPrompt("por que o céu é azul"), "explain");
  });
});

// ─── unwrapMcpResult (anti double-encode) ───────────────────────────────────

describe("unwrapMcpResult", () => {
  it("extrai texto de content só-texto", () => {
    const result = {
      content: [{ type: "text", text: '{"rows":[1,2]}' }],
    };
    assert.deepEqual(unwrapMcpResult(result), {
      text: '{"rows":[1,2]}',
      isError: false,
    });
  });

  it("junta múltiplos itens de texto e propaga isError", () => {
    const result = {
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ],
      isError: true,
    };
    assert.deepEqual(unwrapMcpResult(result), { text: "a\nb", isError: true });
  });

  it("retorna null para content misto ou vazio", () => {
    assert.equal(
      unwrapMcpResult({ content: [{ type: "image", data: "..." }] }),
      null,
    );
    assert.equal(unwrapMcpResult({ content: [] }), null);
    assert.equal(unwrapMcpResult("string solta"), null);
    assert.equal(unwrapMcpResult(null), null);
  });
});

// ─── git-merge com repos temporários ────────────────────────────────────────

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
}

function makeRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "test@test.local"]);
  git(dir, ["config", "user.name", "Test"]);
  fs.writeFileSync(path.join(dir, "base.txt"), "base\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-m", "base"]);
}

function makeWorkspace(baseDir: string, id: string): DelegationWorkspace {
  const branch = `bridge/cursor/${id}`;
  const worktreePath = path.join(baseDir, ".bridge-worktrees", `cursor-${id}`);
  git(baseDir, ["worktree", "add", "-B", branch, worktreePath]);
  return {
    path: worktreePath,
    branch,
    baseBranch: "main",
    basePath: baseDir,
    worktreePath,
    isolated: true,
  };
}

describe("git-merge (worktrees de delegação)", () => {
  let root: string;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "agentos-gitmerge-"));
  });

  after(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // Windows pode segurar handles — lixo em %TEMP% é aceitável em teste
    }
  });

  it("preserve: sem mudanças → skipped e branch apagada", () => {
    const repo = path.join(root, "repo-skip");
    makeRepo(repo);
    const ws = makeWorkspace(repo, "skip1");

    const result = preserveDelegationWorkspace(ws);
    assert.equal(result.resolution, "skipped");
    assert.equal(result.merged, false);
    const branches = git(repo, ["branch", "--list", ws.branch]);
    assert.equal(branches, "");
  });

  it("preserve: com mudanças → commit na branch e branchKept", () => {
    const repo = path.join(root, "repo-keep");
    makeRepo(repo);
    const ws = makeWorkspace(repo, "keep1");
    fs.writeFileSync(path.join(ws.path, "novo.txt"), "trabalho da delegação\n");

    const result = preserveDelegationWorkspace(ws);
    assert.equal(result.resolution, "manual");
    assert.equal(result.branchKept, true);
    assert.match(result.manualMergeHint ?? "", /git merge/);
    // trabalho preservado na branch
    const show = git(repo, ["show", `${ws.branch}:novo.txt`]);
    assert.equal(show, "trabalho da delegação");
  });

  it("finalize: branch atual é a alvo e tree limpa → merge clean", () => {
    const repo = path.join(root, "repo-merge");
    makeRepo(repo);
    const ws = makeWorkspace(repo, "merge1");
    fs.writeFileSync(path.join(ws.path, "feature.txt"), "feature\n");

    const result = finalizeDelegationWorkspace(ws);
    assert.equal(result.merged, true);
    assert.ok(["clean", "fast-forward"].includes(result.resolution));
    assert.equal(fs.existsSync(path.join(repo, "feature.txt")), true);
  });

  it("finalize: conflito → aborta, preserva branch, resolution manual", () => {
    const repo = path.join(root, "repo-conflict");
    makeRepo(repo);
    const ws = makeWorkspace(repo, "conf1");

    // delegação altera base.txt na branch
    fs.writeFileSync(path.join(ws.path, "base.txt"), "versão da delegação\n");
    // usuário altera o MESMO arquivo na main
    fs.writeFileSync(path.join(repo, "base.txt"), "versão do usuário\n");
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-m", "mudança local"]);

    const result = finalizeDelegationWorkspace(ws);
    assert.equal(result.merged, false);
    assert.equal(result.resolution, "manual");
    assert.equal(result.branchKept, true);
    // o lado do usuário NÃO foi sobrescrito
    assert.equal(fs.readFileSync(path.join(repo, "base.txt"), "utf8"), "versão do usuário\n");
    // branch da delegação continua existindo
    assert.notEqual(git(repo, ["branch", "--list", ws.branch]), "");
  });
});
