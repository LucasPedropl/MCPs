import {
  ensureKeepAliveRegistered,
  startKeepAliveScheduler,
  getKeepAliveSchedulerStatus,
  pingAllProjects,
} from "./modules/data/features/projects/services/keepalive-service.js";

async function main(): Promise<void> {
  console.error("[keepalive-worker] iniciando worker 24/7...");

  await ensureKeepAliveRegistered();
  startKeepAliveScheduler();

  setInterval(() => {
    const status = getKeepAliveSchedulerStatus();
    console.error(
      `[keepalive-worker] heartbeat tick=${status.lastSchedulerTickAt ?? "n/a"} success=${status.lastSuccessfulPingAt ?? "n/a"}`,
    );
  }, 60 * 60 * 1000);

  process.on("SIGINT", () => {
    console.error("[keepalive-worker] encerrando...");
    process.exit(0);
  });

  await pingAllProjects();
  await new Promise(() => undefined);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[keepalive-worker] fatal: ${message}`);
  process.exit(1);
});
