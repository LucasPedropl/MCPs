import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getOpenApiEngineEntryPath } from "../../../config/paths.js";
import type { HubConnection } from "../registry/connection-store.js";

interface ChildSession {
  alias: string;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  lastUsedAt: number;
}

const sessions = new Map<string, ChildSession>();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function buildStdioTransport(config: Record<string, unknown>): StdioClientTransport {
  const command = String(config["command"] ?? "npx");
  const args = Array.isArray(config["args"])
    ? config["args"].map((arg) => String(arg))
    : [];

  const env: Record<string, string> = {};
  const rawEnv = config["env"];
  if (rawEnv && typeof rawEnv === "object") {
    for (const [key, value] of Object.entries(rawEnv as Record<string, unknown>)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
  }

  return new StdioClientTransport({
    command,
    args,
    env: { ...(process.env as Record<string, string>), ...env },
    cwd: typeof config["cwd"] === "string" ? config["cwd"] : undefined,
  });
}

function buildHttpTransport(config: Record<string, unknown>): SSEClientTransport {
  const url = String(config["url"] ?? config["sse_url"] ?? "");
  if (!url) {
    throw new Error("Conexão HTTP requer config.url ou config.sse_url.");
  }

  return new SSEClientTransport(new URL(url));
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

function buildTransport(connection: HubConnection): StdioClientTransport | SSEClientTransport {
  if (connection.transport === "http") {
    return buildHttpTransport(connection.config_json);
  }
  if (connection.transport === "openapi") {
    return buildOpenApiTransport(connection);
  }
  return buildStdioTransport(connection.config_json);
}

async function connectChild(connection: HubConnection, retries = 2): Promise<Client> {
  const existing = sessions.get(connection.alias);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.client;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const transport = buildTransport(connection);
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
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
