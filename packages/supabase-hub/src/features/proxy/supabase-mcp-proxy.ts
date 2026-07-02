import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "../accounts/services/account-store.js";
import { getPat } from "../accounts/services/secret-vault.js";

const PROXY_TOOL_NAMES = [
  "list_tables",
  "list_extensions",
  "list_migrations",
  "execute_sql",
  "apply_migration",
  "generate_typescript_types",
  "get_logs",
  "get_advisors",
  "get_project_url",
  "get_publishable_keys",
  "search_docs",
  "list_edge_functions",
  "get_edge_function",
  "deploy_edge_function",
] as const;

export type ProxyToolName = (typeof PROXY_TOOL_NAMES)[number];

export function getProxyToolNames(): readonly string[] {
  return PROXY_TOOL_NAMES;
}

function buildMcpUrl(projectRef: string, readOnly: boolean): URL {
  const url = new URL("https://mcp.supabase.com/mcp");
  url.searchParams.set("project_ref", projectRef);
  if (readOnly) {
    url.searchParams.set("read_only", "true");
  }
  return url;
}

async function createRemoteClient(
  pat: string,
  projectRef: string,
  readOnly: boolean,
): Promise<Client> {
  const client = new Client({
    name: "supabase-mcp-hub-proxy",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(buildMcpUrl(projectRef, readOnly), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${pat}`,
      },
    },
  });

  await client.connect(transport);
  return client;
}

export async function getActiveCredentials(): Promise<{
  pat: string;
  projectRef: string;
  readOnly: boolean;
}> {
  const config = await loadConfig();
  const active = config.activeContext;
  if (!active) {
    throw new Error(
      "Nenhum projeto ativo. Use switch_project antes de chamar tools Supabase.",
    );
  }

  const pat = await getPat(active.accountId);
  if (!pat) {
    throw new Error("PAT não encontrado para a conta ativa.");
  }

  return {
    pat,
    projectRef: active.projectRef,
    readOnly: config.settings.readOnly,
  };
}

export async function callSupabaseTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { pat, projectRef, readOnly } = await getActiveCredentials();
  const client = await createRemoteClient(pat, projectRef, readOnly);

  try {
    const result = await client.callTool(
      { name: toolName, arguments: args },
      CallToolResultSchema,
    );
    return result;
  } finally {
    await client.close();
  }
}

export async function listRemoteTools(): Promise<string[]> {
  const { pat, projectRef, readOnly } = await getActiveCredentials();
  const client = await createRemoteClient(pat, projectRef, readOnly);

  try {
    const listed = await client.listTools();
    return listed.tools.map((tool) => tool.name);
  } finally {
    await client.close();
  }
}
