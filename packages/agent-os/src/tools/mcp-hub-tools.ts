import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorText, jsonText } from "@mcps/shared";
import {
  callChildTool,
  disconnectChild,
  getChildToolSchema,
  listChildTools,
} from "../modules/mcp_hub/child-client/child-mcp-client.js";
import {
  getConnection,
  listConnections,
  registerPresetMcps,
  removeConnection,
  updateConnectionStatus,
  updateToolCache,
  upsertConnection,
} from "../modules/mcp_hub/registry/connection-store.js";
import { createMcpServer } from "../modules/openapi-registry/repository.js";
import {
  registerAllMcpServersInHub,
  registerMcpServerInHub,
} from "../modules/openapi-registry/register-servers.js";
import { runOpenApiSync } from "../modules/openapi-registry/sync-service.js";
import { describeAgentTool } from "./tool-docs.js";

type InstallMcpArgs = {
  mode: "presets" | "registry_all" | "openapi_new" | "openapi_sync";
  name?: string;
  swagger_url?: string;
  api_base_url?: string;
  auth_type?: "none" | "dashboard_login" | "autonomous";
  sync?: boolean;
  server_id?: string;
};

async function handleInstallMcp(args: InstallMcpArgs) {
  if (args.mode === "presets") {
    return jsonText(await registerPresetMcps());
  }

  if (args.mode === "registry_all") {
    return jsonText({ registered: await registerAllMcpServersInHub() });
  }

  if (args.mode === "openapi_new") {
    if (!args.name || !args.swagger_url || !args.api_base_url) {
      return errorText("mode=openapi_new exige 'name', 'swagger_url' e 'api_base_url'.");
    }
    const created = await createMcpServer({
      name: args.name,
      swagger_url: args.swagger_url,
      api_base_url: args.api_base_url,
      auth_type: args.auth_type ?? "none",
    });
    const shouldSync = args.sync !== false;
    const syncReport = shouldSync ? await runOpenApiSync(created.id) : null;
    const hub = await registerMcpServerInHub(created);
    return jsonText({
      server: created,
      hub,
      syncReport,
      usage: `call_mcp_tool alias="${hub.alias}" tool_name="listar_rotas_resumidas"`,
    });
  }

  // openapi_sync
  if (!args.server_id) {
    return errorText("mode=openapi_sync exige 'server_id'.");
  }
  const report = await runOpenApiSync(args.server_id);
  const { getMcpServerById } = await import("../modules/openapi-registry/repository.js");
  const server = await getMcpServerById(args.server_id);
  const hub = await registerMcpServerInHub(server);
  return jsonText({ status: "ok", hub, report });
}

type McpAdminArgs = {
  action: "disconnect" | "remove" | "refresh_health";
  alias: string;
};

async function handleMcpAdmin(args: McpAdminArgs) {
  if (args.action === "disconnect") {
    await disconnectChild(args.alias);
    await updateConnectionStatus(args.alias, "disconnected");
    return jsonText({ alias: args.alias, status: "disconnected" });
  }

  if (args.action === "remove") {
    await disconnectChild(args.alias);
    await removeConnection(args.alias);
    return jsonText({ removed: args.alias });
  }

  // refresh_health
  const connection = await getConnection(args.alias);
  if (!connection) {
    return errorText(`MCP '${args.alias}' não encontrado.`);
  }
  try {
    const tools = await listChildTools(connection);
    await updateToolCache(args.alias, tools);
    return jsonText({ alias: args.alias, status: "connected", toolCount: tools.length });
  } catch (error: unknown) {
    await updateConnectionStatus(args.alias, "error");
    const message = error instanceof Error ? error.message : String(error);
    return errorText(`Health check falhou: ${message}`);
  }
}

export function registerMcpHubTools(server: McpServer): void {
  server.registerTool(
    "list_connected_mcps",
    {
      description: describeAgentTool("list_connected_mcps"),
      inputSchema: {},
    },
    async () => jsonText(await listConnections()),
  );

  server.registerTool(
    "connect_mcp",
    {
      description: describeAgentTool("connect_mcp"),
      inputSchema: {
        alias: z.string(),
        transport: z.enum(["stdio", "http", "openapi"]),
        config: z.record(z.unknown()),
      },
    },
    async (args) => {
      const connection = await upsertConnection({
        alias: args.alias,
        transport: args.transport,
        config: args.config,
      });
      return jsonText(connection);
    },
  );

  server.registerTool(
    "install_mcp",
    {
      description: describeAgentTool("install_mcp"),
      inputSchema: {
        mode: z.enum(["presets", "registry_all", "openapi_new", "openapi_sync"]),
        name: z.string().optional(),
        swagger_url: z.string().url().optional(),
        api_base_url: z.string().url().optional(),
        auth_type: z.enum(["none", "dashboard_login", "autonomous"]).optional(),
        sync: z.boolean().optional(),
        server_id: z.string().optional(),
      },
    },
    async (args) => handleInstallMcp(args as InstallMcpArgs),
  );

  server.registerTool(
    "list_mcp_tools",
    {
      description: describeAgentTool("list_mcp_tools"),
      inputSchema: { alias: z.string() },
    },
    async (args) => {
      const connection = await getConnection(args.alias);
      if (!connection) {
        return errorText(`MCP '${args.alias}' não encontrado.`);
      }
      const tools = await listChildTools(connection);
      await updateToolCache(args.alias, tools);
      return jsonText({ alias: args.alias, tools });
    },
  );

  server.registerTool(
    "get_mcp_tool_schema",
    {
      description: describeAgentTool("get_mcp_tool_schema"),
      inputSchema: {
        alias: z.string(),
        tool_name: z.string(),
      },
    },
    async (args) => {
      const connection = await getConnection(args.alias);
      if (!connection) {
        return errorText(`MCP '${args.alias}' não encontrado.`);
      }
      const schema = await getChildToolSchema(connection, args.tool_name);
      return jsonText(schema);
    },
  );

  server.registerTool(
    "call_mcp_tool",
    {
      description: describeAgentTool("call_mcp_tool"),
      inputSchema: {
        alias: z.string(),
        tool_name: z.string(),
        arguments: z.record(z.unknown()).default({}),
      },
    },
    async (args) => {
      const connection = await getConnection(args.alias);
      if (!connection) {
        return errorText(`MCP '${args.alias}' não encontrado.`);
      }
      const result = await callChildTool(connection, args.tool_name, args.arguments);
      return jsonText(result);
    },
  );

  server.registerTool(
    "mcp_admin",
    {
      description: describeAgentTool("mcp_admin"),
      inputSchema: {
        action: z.enum(["disconnect", "remove", "refresh_health"]),
        alias: z.string(),
      },
    },
    async (args) => handleMcpAdmin(args as McpAdminArgs),
  );
}
