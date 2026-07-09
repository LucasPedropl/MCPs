import * as fs from "node:fs";
import { getOpenApiEngineEntryPath } from "../../config/paths.js";
import { upsertConnection } from "../mcp_hub/registry/connection-store.js";
import { listMcpServers, type McpServerRecord } from "./repository.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildOpenApiAlias(server: Pick<McpServerRecord, "id" | "name">): string {
  const slug = slugify(server.name);
  return slug ? `openapi-${slug}` : `openapi-${server.id.slice(0, 8)}`;
}

export function buildOpenApiHubConfig(serverId: string): Record<string, unknown> {
  const apiPath = getOpenApiEngineEntryPath();
  if (!fs.existsSync(apiPath)) {
    throw new Error(
      `openapi-engine não compilado: ${apiPath}. Rode npm run build:openapi-engine.`,
    );
  }

  return {
    server_id: serverId,
    engine: "openapi-engine",
    command: "node",
    args: [apiPath, "--serverId", serverId],
  };
}

export async function registerMcpServerInHub(
  server: McpServerRecord,
): Promise<{ alias: string; server_id: string }> {
  const alias = buildOpenApiAlias(server);
  await upsertConnection({
    alias,
    transport: "openapi",
    config: buildOpenApiHubConfig(server.id),
  });

  return { alias, server_id: server.id };
}

export async function registerAllMcpServersInHub(): Promise<
  Array<{ alias: string; server_id: string; name: string }>
> {
  const servers = await listMcpServers();
  const registered: Array<{ alias: string; server_id: string; name: string }> = [];

  for (const server of servers) {
    const entry = await registerMcpServerInHub(server);
    registered.push({ ...entry, name: server.name });
  }

  return registered;
}
