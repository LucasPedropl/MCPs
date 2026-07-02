import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  type Account,
  type ActiveContext,
  type AddAccountInput,
  type HubConfig,
  type KeepAliveEntry,
  type Project,
  hubConfigSchema,
} from "../schemas/account.schema.js";
import { deletePat, getPat, savePat } from "./secret-vault.js";
import {
  listProjects as fetchProjects,
  listOrganizations,
  getProjectApiKeys,
  resolveAnonKey,
  projectUrlFromRef,
  testPat,
} from "./management-api.js";
import { getConfigPath } from "./config-path.js";

export { getConfigPath };

function defaultConfig(): HubConfig {
  return {
    version: 1,
    accounts: [],
    projects: [],
    keepAlive: [],
    activeContext: null,
    settings: {
      keepAliveCron: "0 0 */3 * *",
      readOnly: false,
    },
  };
}

export async function loadConfig(): Promise<HubConfig> {
  try {
    const raw = await readFile(getConfigPath(), "utf8");
    const parsed = hubConfigSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(config: HubConfig): Promise<void> {
  const path = getConfigPath();
  await mkdir(join(path, ".."), { recursive: true });
  const validated = hubConfigSchema.parse(config);
  await writeFile(path, JSON.stringify(validated, null, 2), "utf8");
}

export async function addAccount(input: AddAccountInput): Promise<Account> {
  const valid = await testPat(input.pat);
  if (!valid) {
    throw new Error("PAT inválido ou sem permissão para listar projetos.");
  }

  const config = await loadConfig();
  const account: Account = {
    id: randomUUID(),
    label: input.label,
    email: input.email,
    createdAt: new Date().toISOString(),
  };

  await savePat(account.id, input.pat);
  config.accounts.push(account);
  await saveConfig(config);
  return account;
}

export async function removeAccount(accountId: string): Promise<void> {
  const config = await loadConfig();
  config.accounts = config.accounts.filter((a) => a.id !== accountId);
  config.projects = config.projects.filter((p) => p.accountId !== accountId);
  config.keepAlive = config.keepAlive.filter((k) => k.accountId !== accountId);
  if (config.activeContext?.accountId === accountId) {
    config.activeContext = null;
  }
  await saveConfig(config);
  await deletePat(accountId);
}

export async function getAccountPat(accountId: string): Promise<string> {
  const pat = await getPat(accountId);
  if (!pat) {
    throw new Error(`PAT não encontrado para conta ${accountId}.`);
  }
  return pat;
}

export async function syncProjectsForAccount(
  accountId: string,
): Promise<Project[]> {
  const config = await loadConfig();
  const account = config.accounts.find((a) => a.id === accountId);
  if (!account) {
    throw new Error(`Conta ${accountId} não encontrada.`);
  }

  const pat = await getAccountPat(accountId);
  const remote = await fetchProjects(pat);
  const now = new Date().toISOString();

  const synced: Project[] = remote.map((item) => ({
    id: randomUUID(),
    accountId,
    ref: item.ref,
    name: item.name,
    url: projectUrlFromRef(item.ref),
    syncedAt: now,
  }));

  config.projects = [
    ...config.projects.filter((p) => p.accountId !== accountId),
    ...synced,
  ];

  await saveConfig(config);
  return synced;
}

export async function syncAllProjects(): Promise<Project[]> {
  const config = await loadConfig();
  const all: Project[] = [];
  for (const account of config.accounts) {
    const projects = await syncProjectsForAccount(account.id);
    all.push(...projects);
  }
  return all;
}

export async function setActiveContext(
  accountId: string,
  projectRef: string,
): Promise<ActiveContext> {
  const config = await loadConfig();
  const project = config.projects.find(
    (p) => p.accountId === accountId && p.ref === projectRef,
  );

  const context: ActiveContext = {
    accountId,
    projectRef,
    projectName: project?.name,
    switchedAt: new Date().toISOString(),
  };

  config.activeContext = context;
  await saveConfig(config);
  return context;
}

export async function resolveAccountId(
  accountId?: string,
  accountLabel?: string,
): Promise<string> {
  const config = await loadConfig();
  if (accountId) {
    const found = config.accounts.find((a) => a.id === accountId);
    if (!found) {
      throw new Error(`Conta ${accountId} não encontrada.`);
    }
    return found.id;
  }
  if (accountLabel) {
    const found = config.accounts.find(
      (a) => a.label.toLowerCase() === accountLabel.toLowerCase(),
    );
    if (!found) {
      throw new Error(`Conta "${accountLabel}" não encontrada.`);
    }
    return found.id;
  }
  if (config.activeContext?.accountId) {
    return config.activeContext.accountId;
  }
  throw new Error("Informe accountId ou accountLabel.");
}

export async function registerKeepAlive(
  accountId: string,
  projectRef: string,
): Promise<KeepAliveEntry> {
  const config = await loadConfig();
  const project = config.projects.find(
    (p) => p.accountId === accountId && p.ref === projectRef,
  );
  if (!project) {
    throw new Error(`Projeto ${projectRef} não encontrado no cache. Execute sync_projects.`);
  }

  const pat = await getAccountPat(accountId);
  let anonKey = project.anonKey;
  if (!anonKey) {
    const keys = await getProjectApiKeys(pat, projectRef);
    anonKey = resolveAnonKey(keys) ?? undefined;
  }
  if (!anonKey) {
    throw new Error(`Não foi possível obter anon key para ${projectRef}.`);
  }

  const entry: KeepAliveEntry = {
    projectRef,
    accountId,
    url: project.url,
    anonKey,
    enabled: true,
  };

  config.keepAlive = [
    ...config.keepAlive.filter(
      (k) => !(k.accountId === accountId && k.projectRef === projectRef),
    ),
    entry,
  ];

  if (anonKey && project) {
    project.anonKey = anonKey;
  }

  await saveConfig(config);
  return entry;
}

export async function registerAllKeepAlive(): Promise<KeepAliveEntry[]> {
  const config = await loadConfig();
  const entries: KeepAliveEntry[] = [];
  for (const project of config.projects) {
    try {
      const entry = await registerKeepAlive(project.accountId, project.ref);
      entries.push(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[keepalive] skip ${project.ref}: ${message}`);
    }
  }
  return entries;
}

export { listOrganizations };
