import {
  ensureKeepAliveRegistered,
  startKeepAliveScheduler,
} from "./features/projects/services/keepalive-service.js";

/** Inicia scheduler de keep-alive do data module sem segundo stdio MCP. */
export async function startHubServerSchedulers(): Promise<void> {
  await ensureKeepAliveRegistered();
  startKeepAliveScheduler();
}
