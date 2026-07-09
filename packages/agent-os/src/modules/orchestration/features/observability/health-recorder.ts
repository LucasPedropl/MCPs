import { getTargetWorkspacePath } from "../../client/workspace.js";
import { getAntigravityHealth } from "../../providers/antigravity/service.js";
import {
  getAllProviderStatuses,
  getAntigravityDiscoveryStatus,
  getCopilotCliStatus,
  getCursorCliStatus,
} from "../../providers/status.js";
import { getClient } from "../../tools/delegation.js";
import { recordHealthSnapshot } from "./health-store.js";
import type { HealthProvider, HealthSnapshotRow } from "./types.js";

async function probeAntigravity(workspace: string): Promise<HealthSnapshotRow> {
  const discovery = getAntigravityDiscoveryStatus();
  if (!discovery.available) {
    return recordHealthSnapshot({
      workspace,
      provider: "antigravity",
      status: "unavailable",
      detail: { detail: discovery.detail },
    });
  }

  const started = Date.now();
  try {
    const health = await getAntigravityHealth(await getClient());
    return recordHealthSnapshot({
      workspace,
      provider: "antigravity",
      status: "ok",
      latencyMs: Date.now() - started,
      detail: { url: health.url, heartbeat: health.heartbeat },
    });
  } catch (error) {
    return recordHealthSnapshot({
      workspace,
      provider: "antigravity",
      status: "error",
      latencyMs: Date.now() - started,
      detail: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function probeCliProvider(
  workspace: string,
  provider: HealthProvider,
  status: ReturnType<typeof getCopilotCliStatus>,
): Promise<HealthSnapshotRow> {
  return recordHealthSnapshot({
    workspace,
    provider,
    status: status.available ? "ok" : "unavailable",
    detail: { detail: status.detail },
  });
}

/** Grava snapshot de health para todos os providers. */
export async function recordAllProviderHealth(
  workspace = getTargetWorkspacePath(),
): Promise<HealthSnapshotRow[]> {
  const [antigravity, cursor, copilot] = await Promise.all([
    probeAntigravity(workspace),
    probeCliProvider(workspace, "cursor", getCursorCliStatus()),
    probeCliProvider(workspace, "copilot", getCopilotCliStatus()),
  ]);

  return [antigravity, cursor, copilot];
}

export function getProviderStatusSummary() {
  return getAllProviderStatuses();
}
