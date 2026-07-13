import type { BridgeProvider } from "../client/types.js";
import { probeCursorAuth } from "./auth-probe.js";
import { findCursorAgentCli } from "../client/cursor-cli.js";
import { listDiscoveredInstances } from "../client/discovery.js";
import { findAntigravityLauncher, isAntigravityAutoLaunchEnabled } from "../client/launcher.js";
import { getTargetWorkspacePath } from "../client/workspace.js";

export interface ProviderRuntimeStatus {
  provider: BridgeProvider;
  available: boolean;
  detail: string;
  authenticated?: boolean;
}

export function getAntigravityDiscoveryStatus(): ProviderRuntimeStatus {
  const targetWorkspace = getTargetWorkspacePath();
  const instances = listDiscoveredInstances();
  const launcher = findAntigravityLauncher();
  const autoLaunch = isAntigravityAutoLaunchEnabled();

  if (instances.length === 0) {
    if (autoLaunch && launcher) {
      return {
        provider: "antigravity",
        available: true,
        authenticated: true,
        detail:
          `Nenhuma instância ativa; auto-launch habilitado para "${targetWorkspace}" via ${launcher}.`,
      };
    }

    return {
      provider: "antigravity",
      available: false,
      detail: autoLaunch
        ? `Nenhuma instância ativa e launcher não encontrado. Workspace alvo: "${targetWorkspace}".`
        : `Nenhum language_server do Antigravity encontrado. Workspace alvo: "${targetWorkspace}".`,
    };
  }

  const summary = instances
    .map((instance) => {
      const path = instance.workspacePath ?? instance.workspace;
      return `${path} (pid ${instance.pid})`;
    })
    .join("; ");

  return {
    provider: "antigravity",
    available: true,
    authenticated: true,
    detail: `Workspace alvo "${targetWorkspace}". ${instances.length} instância(s): ${summary}`,
  };
}

export function getCursorCliStatus(): ProviderRuntimeStatus {
  const cli = findCursorAgentCli();
  return {
    provider: "cursor",
    available: cli !== null,
    detail: cli
      ? `Cursor Agent CLI encontrado (${cli.source}): ${cli.command}`
      : "Cursor Agent CLI não encontrado. Instale: irm 'https://cursor.com/install?win32=true' | iex",
  };
}

export function getAllProviderStatuses(): ProviderRuntimeStatus[] {
  return [getAntigravityDiscoveryStatus(), getCursorCliStatus()];
}

/** Enriquece status com probe de autenticação (async). */
export async function enrichProviderAuth(
  status: ProviderRuntimeStatus,
): Promise<ProviderRuntimeStatus> {
  if (status.provider === "cursor" && status.available) {
    const auth = await probeCursorAuth();
    return {
      ...status,
      authenticated: auth.authenticated,
      available: status.available && auth.authenticated,
      detail: auth.authenticated ? status.detail : `${status.detail} — ${auth.detail}`,
    };
  }

  return status;
}

export async function getAllProviderStatusesWithAuth(): Promise<ProviderRuntimeStatus[]> {
  const base = getAllProviderStatuses();
  return Promise.all(base.map((item) => enrichProviderAuth(item)));
}
