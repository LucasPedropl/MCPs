import { maskSecret } from "../../lib/mask-secret.js";
import type { KeepAliveEntry, Project } from "../accounts/schemas/account.schema.js";
import { getKeepAliveSchedulerStatus } from "./features/projects/services/keepalive-service.js";

export function sanitizeProject(project: Project | undefined): Project | undefined {
  if (!project) {
    return undefined;
  }

  return {
    ...project,
    anonKey: project.anonKey ? maskSecret(project.anonKey) : undefined,
  };
}

export function sanitizeKeepAliveEntry(entry: KeepAliveEntry): KeepAliveEntry {
  return {
    ...entry,
    anonKey: maskSecret(entry.anonKey) ?? "***",
  };
}

export function buildKeepAliveStatusPayload(entries: KeepAliveEntry[]) {
  const scheduler = getKeepAliveSchedulerStatus();
  return {
    cron: scheduler.cron,
    schedulerStartedAt: scheduler.schedulerStartedAt,
    lastSchedulerTickAt: scheduler.lastSchedulerTickAt,
    lastSuccessfulPingAt: scheduler.lastSuccessfulPingAt,
    entries: entries.map(sanitizeKeepAliveEntry),
  };
}
