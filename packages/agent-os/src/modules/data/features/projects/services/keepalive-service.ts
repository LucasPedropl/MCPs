import { CronJob } from "cron";
import {
  loadConfig,
  saveConfig,
  registerAllKeepAlive,
} from "../../accounts/services/account-store.js";
import type { KeepAliveEntry } from "../../accounts/schemas/account.schema.js";
import { notifyFailedPings } from "../../notifications/webhook-notify.js";
import {
  recordSchedulerTick,
  setSchedulerRunning,
  setSchedulerStartedAt,
} from "../../accounts/services/hub-status.js";

export interface PingResult {
  projectRef: string;
  accountId: string;
  url: string;
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  error?: string;
}

export interface KeepAliveSchedulerStatus {
  schedulerRunning: boolean;
  schedulerStartedAt: string | null;
  lastSchedulerTickAt: string | null;
  lastSuccessfulPingAt: string | null;
  cron: string | null;
}

let cronJob: CronJob | null = null;
let schedulerStartedAt: string | null = null;
let lastSchedulerTickAt: string | null = null;
let lastSuccessfulPingAt: string | null = null;
let currentCron: string | null = null;
let initialPingDone = false;

export function getKeepAliveSchedulerStatus(): KeepAliveSchedulerStatus {
  return {
    schedulerRunning: cronJob !== null,
    schedulerStartedAt,
    lastSchedulerTickAt,
    lastSuccessfulPingAt,
    cron: currentCron,
  };
}

export async function pingProject(entry: KeepAliveEntry): Promise<PingResult> {
  const started = Date.now();
  const healthUrl = `${entry.url.replace(/\/$/, "")}/auth/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        apikey: entry.anonKey,
        Authorization: `Bearer ${entry.anonKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    const latencyMs = Date.now() - started;
    return {
      projectRef: entry.projectRef,
      accountId: entry.accountId,
      url: entry.url,
      ok: response.ok,
      statusCode: response.status,
      latencyMs,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      projectRef: entry.projectRef,
      accountId: entry.accountId,
      url: entry.url,
      ok: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      error: message,
    };
  }
}

async function persistPingResults(results: PingResult[]): Promise<void> {
  const config = await loadConfig();
  const now = new Date().toISOString();

  for (const result of results) {
    const entry = config.keepAlive.find(
      (k) =>
        k.projectRef === result.projectRef &&
        k.accountId === result.accountId,
    );
    if (!entry) {
      continue;
    }
    entry.lastPingAt = now;
    entry.lastLatencyMs = result.latencyMs;
    entry.lastStatus = result.ok ? "ok" : "failed";
    entry.lastError = result.error;
  }

  await saveConfig(config);

  if (results.some((result) => result.ok)) {
    lastSuccessfulPingAt = now;
  }
}

export async function pingAllProjects(): Promise<PingResult[]> {
  lastSchedulerTickAt = new Date().toISOString();
  recordSchedulerTick(lastSchedulerTickAt);

  const config = await loadConfig();
  const enabled = config.keepAlive.filter((k) => k.enabled);
  const results: PingResult[] = [];

  for (const entry of enabled) {
    const result = await pingProject(entry);
    results.push(result);
  }

  await persistPingResults(results);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    await notifyFailedPings(failed);
  }

  return results;
}

async function runScheduledPing(): Promise<void> {
  try {
    await pingAllProjects();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[keepalive] cron failed: ${message}`);
  }
}

export function startKeepAliveScheduler(): void {
  if (cronJob) {
    return;
  }

  void loadConfig().then(async (config) => {
    currentCron = config.settings.keepAliveCron;
    cronJob = CronJob.from({
      cronTime: config.settings.keepAliveCron,
      onTick: () => {
        void runScheduledPing();
      },
      start: true,
      runOnInit: true,
    });

    schedulerStartedAt = new Date().toISOString();
    setSchedulerStartedAt(schedulerStartedAt);
    setSchedulerRunning(true);

    console.error(
      `[keepalive] scheduler started (${config.settings.keepAliveCron}, runOnInit=true)`,
    );

    if (!initialPingDone) {
      initialPingDone = true;
      setTimeout(() => {
        void runScheduledPing().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[keepalive] initial ping failed: ${message}`);
        });
      }, 5_000);
    }
  });
}

export async function ensureKeepAliveRegistered(): Promise<void> {
  const config = await loadConfig();
  if (config.projects.length > 0 && config.keepAlive.length === 0) {
    await registerAllKeepAlive();
  }
}

export function stopKeepAliveScheduler(): void {
  cronJob?.stop();
  cronJob = null;
  currentCron = null;
  setSchedulerRunning(false);
}
