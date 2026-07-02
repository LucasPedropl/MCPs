import type { BridgeProvider } from "../client/types.js";

import { probeCopilotAuth, probeCursorAuth } from "./auth-probe.js";

import { findCopilotCli } from "../client/copilot-cli.js";

import { findCursorAgentCli } from "../client/cursor-cli.js";

import { listDiscoveredInstances } from "../client/discovery.js";

import { findAntigravityLauncher, isAntigravityAutoLaunchEnabled } from "../client/launcher.js";

import { getTargetWorkspacePath } from "../client/workspace.js";

import { getCopilotUsageProfile, isCopilotLightMode } from "./copilot/config.js";



export interface ProviderRuntimeStatus {

  provider: BridgeProvider;

  available: boolean;

  detail: string;

  authenticated?: boolean;

  usageProfile?: "light" | "full";

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



export function getCopilotCliStatus(): ProviderRuntimeStatus {

  const cli = findCopilotCli();

  const profile = getCopilotUsageProfile();

  return {

    provider: "copilot",

    available: cli !== null,

    usageProfile: profile,

    detail: cli

      ? `GitHub Copilot CLI (${profile}${isCopilotLightMode() ? ", student/light" : ""}): ${cli.command}`

      : "GitHub Copilot CLI não encontrado. Instale: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli",

  };

}



export function getAllProviderStatuses(): ProviderRuntimeStatus[] {

  return [getAntigravityDiscoveryStatus(), getCursorCliStatus(), getCopilotCliStatus()];

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



  if (status.provider === "copilot" && status.available) {

    const auth = await probeCopilotAuth();

    return {

      ...status,

      authenticated: auth.authenticated,

      available: status.available && auth.authenticated,

      detail: auth.authenticated ? `${status.detail} — ${auth.detail}` : `${status.detail} — ${auth.detail}`,

    };

  }



  return status;

}



export async function getAllProviderStatusesWithAuth(): Promise<ProviderRuntimeStatus[]> {

  const base = getAllProviderStatuses();

  return Promise.all(base.map((item) => enrichProviderAuth(item)));

}


