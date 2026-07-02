import { startBridgeServer } from "./server.js";

startBridgeServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mcpcomunication] fatal: ${message}`);
  process.exit(1);
});
