// Library exports for agent-os, servidor-web, etc.

export { parseOpenApiPaths, parseSwaggerUrl } from "./services/openapi-parser.js";
export type { ParsedTool, ParsedSwaggerResult } from "./services/openapi-parser.js";

export { runOpenApiSync } from "./services/sync-service.js";

export {
  createMcpServerInstance,
  startMcpEngine,
} from "./services/engine-service.js";

export {
  executeMcpToolProxy,
  executeGenericMcpProxy,
} from "./services/proxy-service.js";

export {
  getServerById,
  getToolsByServerId,
  getCategoriesByServerId,
  getLatestPlaybook,
  savePlaybookVersion,
  saveTestCase,
  getTestCaseByName,
  getTestCases,
  saveTestRun,
  insertToolsBatch,
  saveSyncReport,
} from "./repositories/mcp-repository.js";

export type {
  ServerRecord,
  ToolRecord,
  CategoryRecord,
  TestCaseRecord,
  TestRunRecord,
  SyncReportRecord,
} from "./repositories/mcp-repository.js";

export { runTestCase } from "./services/qa-runner.js";
export type { RunTestCaseResult, TestStepResult } from "./services/qa-runner.js";

export { startSseGateway } from "./gateway/sse-server.js";
export { getSupabaseAdmin } from "./config/supabase.js";
export { runCli } from "./cli.js";
