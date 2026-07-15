import { agentOsEnv } from "../../../config/env.js";
import type { BridgeProvider } from "../client/types.js";

type CircuitState = "closed" | "open" | "half_open";

interface CircuitRecord {
  failures: number;
  state: CircuitState;
  openedAt?: number;
  lastFailure?: number;
}

const records = new Map<BridgeProvider, CircuitRecord>();

function getFailureThreshold(): number {
  const raw = agentOsEnv("CB_FAILURE_THRESHOLD");
  const parsed = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function getResetMs(): number {
  const raw = agentOsEnv("CB_RESET_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : 60_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

function getRecord(provider: BridgeProvider): CircuitRecord {
  let record = records.get(provider);
  if (!record) {
    record = { failures: 0, state: "closed" };
    records.set(provider, record);
  }
  return record;
}

function maybeTransitionToHalfOpen(provider: BridgeProvider, record: CircuitRecord): void {
  if (record.state !== "open" || !record.openedAt) {
    return;
  }
  if (Date.now() - record.openedAt >= getResetMs()) {
    record.state = "half_open";
    records.set(provider, record);
  }
}

/** Provider disponível para tentativa (circuit closed ou half-open). */
export function isProviderCircuitAvailable(provider: BridgeProvider): boolean {
  const record = getRecord(provider);
  maybeTransitionToHalfOpen(provider, record);
  return record.state === "closed" || record.state === "half_open";
}

export function recordProviderSuccess(provider: BridgeProvider): void {
  records.set(provider, { failures: 0, state: "closed" });
}

export function recordProviderFailure(provider: BridgeProvider): void {
  const record = getRecord(provider);
  const failures = record.failures + 1;
  const threshold = getFailureThreshold();

  if (failures >= threshold) {
    records.set(provider, {
      failures,
      state: "open",
      openedAt: Date.now(),
      lastFailure: Date.now(),
    });
    return;
  }

  records.set(provider, {
    ...record,
    failures,
    lastFailure: Date.now(),
    state: record.state === "half_open" ? "open" : record.state,
    openedAt: record.state === "half_open" ? Date.now() : record.openedAt,
  });
}

export function getCircuitBreakerStats(): Record<
  BridgeProvider,
  { state: CircuitState; failures: number; available: boolean }
> {
  const providers: BridgeProvider[] = ["antigravity", "cursor"];
  const stats = {} as Record<
    BridgeProvider,
    { state: CircuitState; failures: number; available: boolean }
  >;

  for (const provider of providers) {
    const record = getRecord(provider);
    maybeTransitionToHalfOpen(provider, record);
    stats[provider] = {
      state: record.state,
      failures: record.failures,
      available: record.state === "closed" || record.state === "half_open",
    };
  }

  return stats;
}
