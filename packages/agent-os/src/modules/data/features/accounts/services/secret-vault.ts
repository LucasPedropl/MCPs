import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SERVICE_NAME = "supabase-mcp-hub";

interface KeytarLike {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

let keytarModule: KeytarLike | null | undefined;

async function loadKeytar(): Promise<KeytarLike | null> {
  if (keytarModule !== undefined) {
    return keytarModule;
  }
  try {
    const mod = await import("keytar");
    const keytar =
      (mod as { default?: KeytarLike }).default ?? (mod as unknown as KeytarLike);
    if (typeof keytar.setPassword === "function") {
      keytarModule = keytar;
      return keytar;
    }
    keytarModule = null;
    return null;
  } catch (error) {
    // Sem keytar o PAT cai para arquivo plaintext — o usuário precisa saber.
    console.error(
      `[secret-vault] keytar indisponível (${error instanceof Error ? error.message : String(error)}) — segredos usarão fallback em arquivo.`,
    );
    keytarModule = null;
    return null;
  }
}

function getSecretsDir(): string {
  const custom = process.env["SUPABASE_HUB_CONFIG_DIR"];
  if (custom) {
    return join(custom, ".secrets");
  }
  return join(homedir(), ".supabase-mcp-hub", ".secrets");
}

function patEnvKey(accountId: string): string {
  return `SUPABASE_HUB_PAT_${accountId.replace(/-/g, "_").toUpperCase()}`;
}

async function writeFileSecret(accountId: string, pat: string): Promise<void> {
  const dir = getSecretsDir();
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${accountId}.pat`);
  await writeFile(filePath, pat, { encoding: "utf8", mode: 0o600 });
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows may ignore chmod
  }
}

async function readFileSecret(accountId: string): Promise<string | null> {
  try {
    const filePath = join(getSecretsDir(), `${accountId}.pat`);
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function deleteFileSecret(accountId: string): Promise<void> {
  try {
    const filePath = join(getSecretsDir(), `${accountId}.pat`);
    const { unlink } = await import("node:fs/promises");
    await unlink(filePath);
  } catch {
    // ignore missing file
  }
}

/** Persists a Supabase PAT securely (keytar → file fallback → env override). */
export async function savePat(accountId: string, pat: string): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE_NAME, accountId, pat);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[secret-vault] keytar failed, using file fallback: ${message}`);
    }
  }
  await writeFileSecret(accountId, pat);
}

/** Retrieves PAT for an account. Env var overrides stored secret. */
export async function getPat(accountId: string): Promise<string | null> {
  const envPat = process.env[patEnvKey(accountId)];
  if (envPat) {
    return envPat;
  }

  const keytar = await loadKeytar();
  if (keytar) {
    const stored = await keytar.getPassword(SERVICE_NAME, accountId);
    if (stored) {
      return stored;
    }
  }

  return readFileSecret(accountId);
}

/** Removes stored PAT for an account. */
export async function deletePat(accountId: string): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    await keytar.deletePassword(SERVICE_NAME, accountId);
  }
  await deleteFileSecret(accountId);
}
