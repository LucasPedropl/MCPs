import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getOpenApiEngineEntryPath } from "../../../config/paths.js";
import type { HubConnection } from "../registry/connection-store.js";

type ChildTransport =
  | StdioClientTransport
  | SSEClientTransport
  | StreamableHTTPClientTransport;

interface ChildSession {
  alias: string;
  client: Client;
  transport: ChildTransport;
  lastUsedAt: number;
}

const sessions = new Map<string, ChildSession>();
const pendingConnections = new Map<string, Promise<Client>>();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Segredos do próprio agent-os que MCPs filhos de terceiros não devem herdar. */
const AGENT_OS_SECRET_ENV = /^(AGENT_OS_|BRIDGE_|SUPABASE_)[A-Z0-9_]*(KEY|TOKEN|SECRET)$/;

export function inheritedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string" || AGENT_OS_SECRET_ENV.test(key)) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

/**
 * Interpola `${VAR}` a partir do process.env. Retorna undefined se alguma VAR
 * não existir — o caller deve DESCARTAR a entrada em vez de passar o literal
 * `${VAR}` (que sobrescreveria a env real herdada pelo filho).
 */
export function interpolateEnvValue(value: string): string | undefined {
  let missing = false;
  const resolved = value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_match, name: string) => {
    const fromProcess = process.env[name];
    if (fromProcess === undefined) {
      missing = true;
      return "";
    }
    return fromProcess;
  });
  return missing ? undefined : resolved;
}

function buildStdioTransport(config: Record<string, unknown>): StdioClientTransport {
  const command = String(config["command"] ?? "npx");
  const args = Array.isArray(config["args"])
    ? config["args"].map((arg) => String(arg))
    : [];

  const env: Record<string, string> = {};
  const rawEnv = config["env"];
  if (rawEnv && typeof rawEnv === "object") {
    for (const [key, value] of Object.entries(rawEnv as Record<string, unknown>)) {
      if (typeof value !== "string") {
        continue;
      }
      const resolved = interpolateEnvValue(value);
      if (resolved === undefined) {
        console.error(
          `[mcp-hub] env '${key}' ignorada: variável referenciada em '${value}' não está definida no ambiente.`,
        );
        continue;
      }
      env[key] = resolved;
    }
  }

  return new StdioClientTransport({
    command,
    args,
    env: { ...inheritedEnv(), ...env },
    cwd: typeof config["cwd"] === "string" ? config["cwd"] : undefined,
  });
}

/**
 * Transports candidatos para conexões http, em ordem de preferência:
 * StreamableHTTP (protocolo atual) → SSE (deprecated, retrocompat).
 * `sse_url` explícito (sem `url`/`http_url`) força SSE legado.
 */
function buildHttpTransportCandidates(
  config: Record<string, unknown>,
): Array<() => ChildTransport> {
  const modernUrl = String(config["url"] ?? config["http_url"] ?? "");
  const sseUrl = String(config["sse_url"] ?? "");
  const url = modernUrl || sseUrl;
  if (!url) {
    throw new Error("Conexão HTTP requer config.url ou config.sse_url.");
  }

  if (!modernUrl && sseUrl) {
    return [() => new SSEClientTransport(new URL(sseUrl))];
  }

  return [
    () => new StreamableHTTPClientTransport(new URL(url)),
    () => new SSEClientTransport(new URL(url)),
  ];
}

function buildOpenApiTransport(connection: HubConnection): StdioClientTransport {
  const config = connection.config_json;
  const serverId = String(config["server_id"] ?? "");
  if (!serverId) {
    throw new Error(`Conexão openapi '${connection.alias}' sem server_id no config.`);
  }

  if (config["command"] && Array.isArray(config["args"])) {
    return buildStdioTransport(config);
  }

  const apiPath = getOpenApiEngineEntryPath();
  return new StdioClientTransport({
    command: "node",
    args: [apiPath, "--serverId", serverId],
    env: process.env as Record<string, string>,
  });
}

function buildTransportCandidates(connection: HubConnection): Array<() => ChildTransport> {
  if (connection.transport === "http") {
    return buildHttpTransportCandidates(connection.config_json);
  }
  if (connection.transport === "openapi") {
    return [() => buildOpenApiTransport(connection)];
  }
  return [() => buildStdioTransport(connection.config_json)];
}

async function doConnectChild(connection: HubConnection, retries: number): Promise<Client> {
  const candidates = buildTransportCandidates(connection);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    for (const createTransport of candidates) {
      try {
        const transport = createTransport();
        const client = new Client(
          { name: "agent-os-hub", version: "0.1.0" },
          { capabilities: {} },
        );

        await client.connect(transport);
        sessions.set(connection.alias, {
          alias: connection.alias,
          client,
          transport,
          lastUsedAt: Date.now(),
        });

        return client;
      } catch (error: unknown) {
        lastError = error;
      }
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function connectChild(connection: HubConnection, retries = 2): Promise<Client> {
  const existing = sessions.get(connection.alias);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.client;
  }

  // Dedupe: chamadas concorrentes ao mesmo alias compartilham a mesma conexão
  // em andamento em vez de spawnar dois filhos (e vazar um transport).
  const pending = pendingConnections.get(connection.alias);
  if (pending) {
    return pending;
  }

  const promise = doConnectChild(connection, retries).finally(() => {
    pendingConnections.delete(connection.alias);
  });
  pendingConnections.set(connection.alias, promise);
  return promise;
}

export async function disconnectChild(alias: string): Promise<void> {
  const session = sessions.get(alias);
  if (!session) {
    return;
  }

  await session.transport.close();
  sessions.delete(alias);
}

export async function listChildTools(
  connection: HubConnection,
): Promise<Array<{ name: string; description?: string }>> {
  const client = await connectChild(connection);
  const response = await client.listTools();
  return response.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));
}

export async function getChildToolSchema(
  connection: HubConnection,
  toolName: string,
): Promise<Record<string, unknown>> {
  const client = await connectChild(connection);
  const response = await client.listTools();
  const full = response.tools.find((entry) => entry.name === toolName);
  if (!full) {
    throw new Error(`Schema não encontrado para '${toolName}' em '${connection.alias}'`);
  }

  return {
    name: full.name,
    description: full.description,
    inputSchema: full.inputSchema,
  };
}

export async function callChildTool(
  connection: HubConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = await connectChild(connection);
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  const session = sessions.get(connection.alias);
  if (session) {
    session.lastUsedAt = Date.now();
  }

  return result;
}

export function cleanupIdleSessions(): void {
  const now = Date.now();
  for (const [alias, session] of sessions.entries()) {
    if (now - session.lastUsedAt > IDLE_TIMEOUT_MS) {
      void session.transport.close();
      sessions.delete(alias);
    }
  }
}

setInterval(cleanupIdleSessions, 60_000).unref();
