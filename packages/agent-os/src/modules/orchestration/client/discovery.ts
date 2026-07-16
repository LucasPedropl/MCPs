import { execSync } from "node:child_process";
import * as path from "node:path";
import type { AntigravityInstance } from "./types.js";
import {
  describeLaunchTarget,
  findAntigravityLauncher,
  getAntigravityLaunchTimeoutMs,
  isAntigravityAutoLaunchEnabled,
  launchAntigravityIde,
  waitForLaunchDelay,
} from "./launcher.js";
import { resolveLanguageServerPort } from "./port-discovery.js";
import {
  getTargetWorkspacePath,
  getWorkspaceMatchHint,
  instanceMatchesWorkspace,
  normalizePath,
} from "./workspace.js";

/**
 * Decode HEURÍSTICO do workspace_id: o encoding do Antigravity é lossy
 * (tanto "/" quanto "_" viram "_"), então underscores reais em nomes de pasta
 * saem corrompidos daqui. Use apenas para exibição/heurística — o matching de
 * workspace compara no espaço ENCODED (ver instanceMatchesWorkspace).
 */
export function decodeWorkspaceId(workspaceId: string): string {
  if (!workspaceId.startsWith("file_")) {
    return workspaceId;
  }

  const rest = workspaceId.slice(5);
  const match = rest.match(/^([a-z])_3A_(.+)$/i);
  if (!match) {
    return workspaceId.replace(/_/g, "/");
  }

  const drive = match[1];
  const pathPart = match[2]?.replace(/_/g, "/") ?? "";
  return `${drive}:/${pathPart}`;
}

function parseCommandLine(commandLine: string): Omit<AntigravityInstance, "port" | "secure"> | null {
  if (!commandLine.includes("language_server") || !commandLine.includes("csrf_token")) {
    return null;
  }

  const csrfMatch =
    commandLine.match(/--csrf_token\s+([\w-]+)/) ??
    commandLine.match(/--csrf_token=([\w-]+)/);
  const portMatch =
    commandLine.match(/--extension_server_port\s+(\d+)/) ??
    commandLine.match(/--extension_server_port=(\d+)/);
  const httpsPortMatch =
    commandLine.match(/--https_server_port\s+(\d+)/) ??
    commandLine.match(/--https_server_port=(\d+)/);
  const workspaceMatch =
    commandLine.match(/--workspace_id\s+(\S+)/) ??
    commandLine.match(/--workspace_id=(\S+)/);

  if (!csrfMatch || !portMatch) {
    return null;
  }

  const workspaceId = workspaceMatch?.[1] ?? "unknown";
  const workspacePath = workspaceId !== "unknown" ? decodeWorkspaceId(workspaceId) : undefined;

  return {
    // PID não é adivinhado da command line ("primeiro número" pegava pedaços
    // de path); cada caller preenche a partir da fonte confiável (coluna do
    // ps / prefixo ProcessId| do PowerShell).
    pid: 0,
    csrfToken: csrfMatch[1]!,
    workspace: workspaceId,
    workspacePath,
    extensionServerPort: Number.parseInt(portMatch[1]!, 10),
    httpsServerPort: httpsPortMatch
      ? Number.parseInt(httpsPortMatch[1]!, 10)
      : undefined,
  };
}

function discoverWindowsInstances(): Array<Omit<AntigravityInstance, "port" | "secure">> {
  const psScript = [
    "$ProgressPreference='SilentlyContinue';",
    "Get-CimInstance Win32_Process |",
    "Where-Object { $_.CommandLine -match 'language_server' -and $_.CommandLine -match 'csrf_token' } |",
    "ForEach-Object { $_.ProcessId.ToString() + '|' + $_.CommandLine }",
  ].join(" ");

  try {
    const encoded = Buffer.from(psScript, "utf16le").toString("base64");
    const output = execSync(`powershell.exe -NoProfile -EncodedCommand ${encoded}`, {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("|");
        if (separator === -1) {
          return parseCommandLine(line);
        }
        const commandLine = line.slice(separator + 1);
        const parsed = parseCommandLine(commandLine);
        if (!parsed) {
          return null;
        }
        const pid = Number.parseInt(line.slice(0, separator), 10);
        return Number.isFinite(pid) ? { ...parsed, pid } : parsed;
      })
      .filter(
        (instance): instance is Omit<AntigravityInstance, "port" | "secure"> => instance !== null,
      );
  } catch {
    return [];
  }
}

function discoverUnixInstances(): Array<Omit<AntigravityInstance, "port" | "secure">> {
  try {
    const psOutput = execSync("ps aux", { encoding: "utf8", timeout: 5_000 });
    return psOutput
      .split("\n")
      .filter((line) => line.includes("language_server") && line.includes("csrf_token"))
      .map((line) => {
        const parsed = parseCommandLine(line);
        if (!parsed) {
          return null;
        }
        // ps aux: PID é a 2ª coluna.
        const pid = Number.parseInt(line.trim().split(/\s+/)[1] ?? "", 10);
        return Number.isFinite(pid) ? { ...parsed, pid } : parsed;
      })
      .filter(
        (instance): instance is Omit<AntigravityInstance, "port" | "secure"> => instance !== null,
      );
  } catch {
    return [];
  }
}

// Cache curto: cada discovery spawna PowerShell/ps — chamadas em sequência
// (bridge_status, delegações no mesmo turno) não precisam pagar isso de novo.
const DISCOVERY_CACHE_TTL_MS = 10_000;
let discoveryCache: {
  at: number;
  instances: Array<Omit<AntigravityInstance, "port" | "secure">>;
} | null = null;

function discoverRawInstances(fresh = false): Array<Omit<AntigravityInstance, "port" | "secure">> {
  if (!fresh && discoveryCache && Date.now() - discoveryCache.at < DISCOVERY_CACHE_TTL_MS) {
    return discoveryCache.instances;
  }

  const instances =
    process.platform === "win32" ? discoverWindowsInstances() : discoverUnixInstances();
  discoveryCache = { at: Date.now(), instances };
  return instances;
}

function rawInstanceFromEnv(): (Omit<AntigravityInstance, "port" | "secure"> & { portOverride: number }) | null {
  const port = process.env["ANTIGRAVITY_PORT"];
  const csrfToken = process.env["ANTIGRAVITY_CSRF_TOKEN"];

  if (!port || !csrfToken) {
    return null;
  }

  return {
    pid: 0,
    csrfToken,
    workspace: process.env["ANTIGRAVITY_WORKSPACE"] ?? "manual",
    extensionServerPort: Number.parseInt(port, 10) - 1,
    portOverride: Number.parseInt(port, 10),
  };
}

function pickInstanceLoose(
  instances: Array<Omit<AntigravityInstance, "port" | "secure">>,
): Omit<AntigravityInstance, "port" | "secure"> {
  const withWorkspace = instances.filter((instance) => instance.workspacePath);
  const candidates = withWorkspace.length > 0 ? withWorkspace : instances;
  const workspaceHint = getWorkspaceMatchHint();
  const normalizedHint = normalizePath(workspaceHint);
  const hintBasename = normalizedHint.split("/").pop() ?? normalizedHint;

  const byPath = candidates.find((instance) => {
    if (!instance.workspacePath) {
      return false;
    }
    const normalizedPath = normalizePath(instance.workspacePath);
    return (
      normalizedPath === normalizedHint ||
      normalizedPath.endsWith(`/${hintBasename}`) ||
      normalizedHint.endsWith(`/${instance.workspace.split("_").pop()?.toLowerCase() ?? ""}`)
    );
  });

  if (byPath) {
    return byPath;
  }

  const byWorkspaceId = candidates.find((instance) =>
    instance.workspace.toLowerCase().includes(hintBasename),
  );

  return byWorkspaceId ?? candidates[0]!;
}

function findInstanceForTargetWorkspace(
  instances: Array<Omit<AntigravityInstance, "port" | "secure">>,
  targetPath: string,
): Omit<AntigravityInstance, "port" | "secure"> | null {
  return (
    instances.find((instance) =>
      instanceMatchesWorkspace(instance.workspacePath, instance.workspace, targetPath),
    ) ?? null
  );
}

async function finalizeInstance(
  raw: Omit<AntigravityInstance, "port" | "secure">,
): Promise<AntigravityInstance> {
  const { port, secure } = await resolveLanguageServerPort(raw);
  return { ...raw, port, secure };
}

async function tryFinalizeMatchedInstance(
  raw: Omit<AntigravityInstance, "port" | "secure">,
): Promise<AntigravityInstance | null> {
  try {
    return await finalizeInstance(raw);
  } catch {
    return null;
  }
}

async function waitForTargetInstance(targetPath: string): Promise<AntigravityInstance> {
  const timeoutMs = getAntigravityLaunchTimeoutMs();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    // fresh: estamos esperando uma instância NOVA subir — cache atrapalharia.
    const instances = discoverRawInstances(true);
    const matched = findInstanceForTargetWorkspace(instances, targetPath);
    if (matched) {
      const ready = await tryFinalizeMatchedInstance(matched);
      if (ready) {
        return ready;
      }
    }
    await waitForLaunchDelay();
  }

  throw new Error(
    `Antigravity não ficou pronto para o workspace "${targetPath}" em ${timeoutMs}ms. ` +
      "A IDE abriu, mas a API do language server não respondeu.",
  );
}

async function ensureAntigravityForWorkspace(
  workspaceOverride?: string,
): Promise<AntigravityInstance> {
  const targetPath = workspaceOverride?.trim()
    ? path.resolve(workspaceOverride.trim())
    : getTargetWorkspacePath();
  const instances = discoverRawInstances();
  const matched = findInstanceForTargetWorkspace(instances, targetPath);

  if (matched) {
    const ready = await tryFinalizeMatchedInstance(matched);
    if (ready) {
      return ready;
    }
    return waitForTargetInstance(targetPath);
  }

  if (!isAntigravityAutoLaunchEnabled()) {
    if (instances.length > 0) {
      return finalizeInstance(pickInstanceLoose(instances));
    }
    throw new Error(
      `Nenhuma instância do Antigravity para "${targetPath}". ` +
        "Abra a IDE manualmente ou defina BRIDGE_ANTIGRAVITY_AUTO_LAUNCH=true.",
    );
  }

  if (!findAntigravityLauncher()) {
    throw new Error(
      `Nenhuma instância do Antigravity para "${targetPath}" e launcher não encontrado. ` +
        "Instale o comando agy na IDE ou defina BRIDGE_ANTIGRAVITY_LAUNCHER.",
    );
  }

  launchAntigravityIde(targetPath, instances.length > 0);
  discoveryCache = null;
  return waitForTargetInstance(targetPath);
}

export async function resolveInstance(
  workspaceOverride?: string,
): Promise<AntigravityInstance> {
  const envRaw = rawInstanceFromEnv();
  if (envRaw) {
    const { portOverride, ...rest } = envRaw;
    return { ...rest, port: portOverride };
  }

  return ensureAntigravityForWorkspace(workspaceOverride);
}

export function listDiscoveredInstances(): AntigravityInstance[] {
  // Diagnóstico deve refletir o estado atual, não o cache.
  return discoverRawInstances(true).map((raw) => ({ ...raw, port: 0 }));
}

export function getResolvedTargetWorkspace(): string {
  return describeLaunchTarget();
}
