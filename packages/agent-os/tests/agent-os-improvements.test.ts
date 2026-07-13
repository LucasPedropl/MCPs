import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskSecret, redactMcpConfig } from "../src/lib/mask-secret.js";
import { parseListTablesResult } from "../src/modules/data/schema-parser.js";
import { detectStack } from "../src/modules/bootstrap/bootstrap-detect.js";
import path from "node:path";

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
