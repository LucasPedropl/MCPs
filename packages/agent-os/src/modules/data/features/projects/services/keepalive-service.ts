import * as fs from "node:fs";
import * as path from "node:path";
import { CronJob } from "cron";
import {
  loadConfig,
  saveConfig,
  registerAllKeepAlive,
  getConfigPath,
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
let lockRefreshTimer: NodeJS.Timeout | null = null;

// Eleição de líder por lockfile: com N instâncias do agent-os (Claude Code +
// Cursor + Antigravity), só uma deve pingar — senão cada projeto recebe N×.
const LOCK_FRESH_MS = 10 * 60 * 1000;
const LOCK_REFRESH_MS = 5 * 60 * 1000;

function schedulerLockPath(): string {
  return path.join(path.dirname(getConfigPath()), "keepalive-scheduler.lock");
}

function readSchedulerLock(): { pid: number; updatedAt: number } | null {
  try {
    return JSON.parse(fs.readFileSync(schedulerLockPath(), "utf8")) as {
      pid: number;
      updatedAt: number;
    };
  } catch {
    return null;
  }
}

function writeSchedulerLock(): void {
  try {
    fs.mkdirSync(path.dirname(schedulerLockPath()), { recursive: true });
    fs.writeFileSync(
      schedulerLockPath(),
      JSON.stringify({ pid: process.pid, updatedAt: Date.now() }),
      "utf8",
    );
  } catch {
    // lock é best-effort
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireSchedulerLock(): boolean {
  const existing = readSchedulerLock();
  if (
    existing &&
    existing.pid !== process.pid &&
    Date.now() - existing.updatedAt < LOCK_FRESH_MS &&
    isProcessAlive(existing.pid)
  ) {
    return false;
  }

  writeSchedulerLock();
  // Releitura pós-escrita: se outra instância escreveu por cima no mesmo
  // instante, o pid gravado decide quem fica com o scheduler.
  const after = readSchedulerLock();
  return after?.pid === process.pid;
}

function releaseSchedulerLock(): void {
  const existing = readSchedulerLock();
  if (existing?.pid === process.pid) {
    try {
      fs.rmSync(schedulerLockPath(), { force: true });
    } catch {
      // best-effort
    }
  }
}

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

  if (!acquireSchedulerLock()) {
    console.error(
      "[keepalive] outra instância do agent-os já roda o scheduler — pulando nesta instância.",
    );
    return;
  }

  lockRefreshTimer = setInterval(writeSchedulerLock, LOCK_REFRESH_MS);
  lockRefreshTimer.unref();

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
  if (lockRefreshTimer) {
    clearInterval(lockRefreshTimer);
    lockRefreshTimer = null;
  }
  releaseSchedulerLock();
  setSchedulerRunning(false);
}
