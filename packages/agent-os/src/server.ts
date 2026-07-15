import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AGENT_OS_INSTRUCTIONS, registerCoreTools } from "./tools/core-tools.js";
import { applyToolFilter } from "./tools/tool-filter.js";
import { registerMemoryTools } from "./tools/memory-tools.js";
import { registerBootstrapTools } from "./tools/bootstrap-tools.js";
import { registerContextTools } from "./tools/context-tools.js";
import { registerKnowledgeTools } from "./tools/knowledge-tools.js";
import { registerMcpHubTools } from "./tools/mcp-hub-tools.js";
import { registerRunnerTools } from "./tools/runner-tools.js";
import { registerAgentOsOrchestrationExtensions } from "./tools/orchestration-extensions.js";
import { registerOrchestrationTools } from "./modules/orchestration/register-orchestration.js";
import { registerDataTools } from "./modules/data/register-data.js";
import { registerPolicyTools } from "./tools/policy-tools.js";
import { registerProjectTools } from "./tools/project-tools.js";
import { recoverOrphanJobs } from "./modules/orchestration/features/jobs/job-runner.js";
import { startRealtimeWorker } from "./modules/orchestration/features/jobs/realtime-worker.js";
import {
  getEnabledModules,
  getSupabaseKeyRole,
  isRealtimeWorkerEnabled,
  type AgentOsModule,
} from "./config/env.js";
import { startHubServerSchedulers } from "./modules/data/server-schedulers.js";

const MODULE_REGISTRARS: Record<AgentOsModule, (server: McpServer) => void> = {
  memory: registerMemoryTools,
  bootstrap: registerBootstrapTools,
  context: registerContextTools,
  knowledge: registerKnowledgeTools,
  mcp_hub: registerMcpHubTools,
  runner: registerRunnerTools,
  orchestration: (server) => {
    registerOrchestrationTools(server);
    registerAgentOsOrchestrationExtensions(server);
  },
  data: registerDataTools,
  policy: registerPolicyTools,
  projects: registerProjectTools,
};

export function createAgentOsServer(): McpServer {
  const server = new McpServer(
    {
      name: "agent-os",
      version: "0.1.0",
    },
    {
      instructions: AGENT_OS_INSTRUCTIONS,
    },
  );

  applyToolFilter(server);

  const enabled = getEnabledModules();
  registerCoreTools(server);
  for (const [module, register] of Object.entries(MODULE_REGISTRARS)) {
    if (enabled.has(module as AgentOsModule)) {
      register(server);
    }
  }

  return server;
}

function warnIfAnonKey(): void {
  const role = getSupabaseKeyRole();
  if (role && role !== "service_role") {
    console.error(
      `[agent-os] AVISO: AGENT_OS_SUPABASE_KEY é '${role}' (não service_role). ` +
        "Escritas em agent_projects (bootstrap_project/upsert_project) serão bloqueadas por RLS " +
        "e degradadas com warning. Use a service_role key para funcionalidade completa.",
    );
  }
}

export async function startAgentOsServer(): Promise<void> {
  warnIfAnonKey();

  const enabled = getEnabledModules();

  if (enabled.has("orchestration")) {
    void recoverOrphanJobs().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[agent-os] orphan recovery falhou: ${message}`);
    });

    if (isRealtimeWorkerEnabled()) {
      startRealtimeWorker();
    }
  }

  if (enabled.has("data")) {
    startHubServerSchedulers().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[agent-os] keep-alive scheduler falhou: ${message}`);
    });
  }

  const server = createAgentOsServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
