import crypto from "node:crypto";
import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import type { ServerRecord, TestCaseRecord } from "../repositories/mcp-repository.js";
import {
  getServerById,
  saveTestRun,
} from "../repositories/mcp-repository.js";
import { executeGenericMcpProxy } from "./proxy-service.js";

export interface TestStepResult {
  requestId: string;
  status: number;
  success: boolean;
  latencyMs?: number;
  data: unknown;
  error: string | null;
}

export interface RunTestCaseResult {
  testCaseId: string;
  name?: string;
  status: string;
  durationMs: number;
  steps: TestStepResult[];
}

export function generateRandomCPF(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n1 = num(), n2 = num(), n3 = num(), n4 = num(), n5 = num(), n6 = num(), n7 = num(), n8 = num(), n9 = num();
  let d1 = n9 * 2 + n8 * 3 + n7 * 4 + n6 * 5 + n5 * 6 + n4 * 7 + n3 * 8 + n2 * 9 + n1 * 10;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  let d2 = d1 * 2 + n9 * 3 + n8 * 4 + n7 * 5 + n6 * 6 + n5 * 7 + n4 * 8 + n3 * 9 + n2 * 10 + n1 * 11;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

export function generateRandomCNPJ(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n1 = num(), n2 = num(), n3 = num(), n4 = num(), n5 = num(), n6 = num(), n7 = num(), n8 = num();
  const n9 = 0, n10 = 0, n11 = 0, n12 = 1;
  let d1 = n12 * 2 + n11 * 3 + n10 * 4 + n9 * 5 + n8 * 6 + n7 * 7 + n6 * 8 + n5 * 9 + n4 * 2 + n3 * 3 + n2 * 4 + n1 * 5;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  let d2 = d1 * 2 + n12 * 3 + n11 * 4 + n10 * 5 + n9 * 6 + n8 * 7 + n7 * 8 + n6 * 9 + n5 * 2 + n4 * 3 + n3 * 4 + n2 * 5 + n1 * 6;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${n10}${n11}${n12}${d1}${d2}`;
}

export function generateRandomEmail(): string {
  return `test_qa_${Math.floor(100000 + Math.random() * 900000)}@mcp-qa-engine.com`;
}

export function generateRandomName(): string {
  const firstNames = ["Ana", "Bruno", "Carlos", "Daniela", "Eduardo", "Fernanda", "Gabriel", "Helena", "Igor", "Julia"];
  const lastNames = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes"];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

export function generateRandomPhone(): string {
  const prefix = "9" + Math.floor(7000 + Math.random() * 2999);
  const suffix = Math.floor(1000 + Math.random() * 8999);
  return `11${prefix}${suffix}`;
}

export function generateRandomUUID(): string {
  return crypto.randomUUID();
}

type ResultsMap = Map<string, unknown>;

export function resolvePlaceholders(val: unknown, resultsMap: ResultsMap, strict = false): unknown {
  if (typeof val === "string") {
    let resolved = val
      .replace(/\{\{\s*\$randomCPF\s*\}\}/g, () => generateRandomCPF())
      .replace(/\{\{\s*\$randomCNPJ\s*\}\}/g, () => generateRandomCNPJ())
      .replace(/\{\{\s*\$randomEmail\s*\}\}/g, () => generateRandomEmail())
      .replace(/\{\{\s*\$randomName\s*\}\}/g, () => generateRandomName())
      .replace(/\{\{\s*\$randomPhone\s*\}\}/g, () => generateRandomPhone())
      .replace(/\{\{\s*\$randomUUID\s*\}\}/g, () => generateRandomUUID());

    return resolved.replace(/\{\{([^}]+)\}\}/g, (match, pathStr: string) => {
      const trimmedPath = pathStr.trim();
      if (trimmedPath.startsWith("$random")) return match;

      const parts = trimmedPath.split(".");
      const sourceId = parts[0];
      if (!sourceId || !resultsMap.has(sourceId)) return match;

      const sourceResult = resultsMap.get(sourceId);

      if (parts.length === 1) {
        if (sourceResult === null || sourceResult === undefined || typeof sourceResult !== "object") {
          return String(sourceResult);
        }

        const idKeys: string[] = [];
        const scanKeys = (obj: Record<string, unknown>, prefix = ""): void => {
          for (const key of Object.keys(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (/id/i.test(key)) idKeys.push(fullKey);
            const child = obj[key];
            if (child && typeof child === "object" && !Array.isArray(child) && prefix === "") {
              scanKeys(child as Record<string, unknown>, key);
            }
          }
        };
        scanKeys(sourceResult as Record<string, unknown>);

        if (idKeys.length === 1 && idKeys[0]) {
          let cur: unknown = sourceResult;
          for (const p of idKeys[0].split(".")) {
            cur = (cur as Record<string, unknown>)?.[p];
          }
          return String(cur);
        }

        if (strict && idKeys.length > 1) {
          throw new Error(`Ambiguidade de ID em "${sourceId}": ${idKeys.join(", ")}`);
        }
        if (strict && idKeys.length === 0) {
          throw new Error(`Nenhum ID em "${sourceId}"`);
        }
        return String(sourceResult);
      }

      let current: unknown = sourceResult;
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part || current === null || current === undefined) {
          if (strict) throw new Error(`Caminho inválido "${trimmedPath}"`);
          return match;
        }
        current = (current as Record<string, unknown>)[part];
      }
      return current !== undefined ? String(current) : match;
    });
  }

  if (Array.isArray(val)) return val.map((item) => resolvePlaceholders(item, resultsMap, strict));

  if (val && typeof val === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = resolvePlaceholders(v, resultsMap, strict);
    }
    return res;
  }

  return val;
}

function buildResultsMap(variables: Record<string, unknown>): ResultsMap {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(variables)) {
    map.set(k, v);
  }
  return map;
}

interface TestStep {
  requestId: string;
  method: string;
  endpoint: string;
  body?: unknown;
  queryParams?: Record<string, unknown>;
  authProfileId?: string;
}

async function runStepsViaFetch(
  server: ServerRecord,
  steps: TestStep[],
  resultsMap: ResultsMap,
): Promise<{ status: string; steps: TestStepResult[] }> {
  const results: TestStepResult[] = [];
  let status = "success";

  for (const step of steps) {
    const stepStart = Date.now();
    try {
      const resolvedEndpoint = String(resolvePlaceholders(step.endpoint, resultsMap));
      const resolvedBody = step.body ? resolvePlaceholders(step.body, resultsMap) : undefined;
      const resolvedQuery = step.queryParams
        ? (resolvePlaceholders(step.queryParams, resultsMap) as Record<string, unknown>)
        : undefined;

      let url = `${server.api_base_url.replace(/\/$/, "")}/${resolvedEndpoint.replace(/^\//, "")}`;
      if (resolvedQuery && Object.keys(resolvedQuery).length > 0) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(resolvedQuery)) {
          params.append(k, String(v));
        }
        url += `?${params.toString()}`;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const profileId = step.authProfileId || "none";
      const profiles = (server.auth_credentials as { profiles?: Array<{ id: string; token?: string }> })?.profiles;
      if (profileId !== "none" && profiles) {
        const prof = profiles.find((p) => p.id === profileId);
        if (prof?.token) headers.Authorization = `Bearer ${prof.token}`;
      }

      const method = step.method.toUpperCase();
      const fetchOptions: UndiciRequestInit = { method, headers };
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && resolvedBody) {
        fetchOptions.body = JSON.stringify(resolvedBody);
      }

      const res = await undiciFetch(url, fetchOptions);
      const latency = Date.now() - stepStart;
      const text = await res.text();
      let responseData: unknown = text;
      try {
        responseData = JSON.parse(text);
      } catch {
        /* keep text */
      }

      const success = res.ok;
      results.push({
        requestId: step.requestId,
        status: res.status,
        success,
        latencyMs: latency,
        data: success ? responseData : null,
        error: success ? null : String(responseData),
      });
      resultsMap.set(step.requestId, responseData);

      if (!success) {
        status = "failed";
        break;
      }
    } catch (err: unknown) {
      results.push({
        requestId: step.requestId,
        status: 500,
        success: false,
        latencyMs: Date.now() - stepStart,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
      status = "failed";
      break;
    }
  }

  return { status, steps: results };
}

async function runStepsViaProxy(
  server: ServerRecord,
  steps: TestStep[],
  resultsMap: ResultsMap,
): Promise<{ status: string; steps: TestStepResult[] }> {
  const results: TestStepResult[] = [];
  let status = "success";
  const freshServer = await getServerById(server.id);

  for (const step of steps) {
    const stepStart = Date.now();
    try {
      const resolvedEndpoint = String(resolvePlaceholders(step.endpoint, resultsMap, true));
      const resolvedBody = step.body ? resolvePlaceholders(step.body, resultsMap, true) : undefined;
      const resolvedQuery = step.queryParams
        ? (resolvePlaceholders(step.queryParams, resultsMap, true) as Record<string, unknown>)
        : undefined;

      const res = await executeGenericMcpProxy(
        freshServer,
        resolvedEndpoint,
        step.method,
        resolvedBody,
        resolvedQuery,
        false,
        step.authProfileId,
      );

      const isError =
        res.isError ||
        Boolean(res.content?.[0]?.text?.startsWith("Error"));

      let data: unknown = null;
      if (!isError && res.content?.[0]) {
        try {
          const text = res.content[0].text ?? "";
          const jsonText = text.replace(/^\[AVISO DO SERVIDOR MCP:[^\]]+\]\n\nResposta da API:\n/, "");
          data = JSON.parse(jsonText);
        } catch {
          data = res.content[0].text;
        }
      }

      results.push({
        requestId: step.requestId,
        status: isError ? 400 : 200,
        success: !isError,
        latencyMs: Date.now() - stepStart,
        data: isError ? null : data,
        error: isError ? res.content?.[0]?.text ?? "Erro desconhecido" : null,
      });
      resultsMap.set(step.requestId, data);

      if (isError) {
        status = "failed";
        break;
      }
    } catch (err: unknown) {
      results.push({
        requestId: step.requestId,
        status: 500,
        success: false,
        latencyMs: Date.now() - stepStart,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
      status = "failed";
      break;
    }
  }

  return { status, steps: results };
}

export async function runTestCase(
  server: ServerRecord,
  testCase: TestCaseRecord,
  options: {
    variablesOverride?: Record<string, unknown>;
    mode?: "fetch" | "proxy";
    persist?: boolean;
  } = {},
): Promise<RunTestCaseResult> {
  const { variablesOverride = {}, mode = "fetch", persist = true } = options;
  const finalVariables = {
    ...(testCase.variables_schema || {}),
    ...variablesOverride,
  };
  const resultsMap = buildResultsMap(finalVariables);
  const steps = testCase.steps as TestStep[];
  const startTime = Date.now();

  const { status, steps: stepResults } =
    mode === "proxy"
      ? await runStepsViaProxy(server, steps, resultsMap)
      : await runStepsViaFetch(server, steps, resultsMap);

  const durationMs = Date.now() - startTime;

  if (persist) {
    await saveTestRun(testCase.id, status, durationMs, stepResults);
  }

  return {
    testCaseId: testCase.id,
    name: testCase.name,
    status,
    durationMs,
    steps: stepResults,
  };
}
