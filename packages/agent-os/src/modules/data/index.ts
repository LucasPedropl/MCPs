import { startHubServer } from "./server.js";

startHubServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[supabase-mcp-hub] fatal: ${message}`);
  process.exit(1);
});
