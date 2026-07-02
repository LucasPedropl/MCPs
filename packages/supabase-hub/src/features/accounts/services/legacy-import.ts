import {
  addAccount,
  setActiveContext,
  syncProjectsForAccount,
} from "./account-store.js";
import {
  getHubStatus,
  readLegacySupabaseMcpConfig,
} from "./hub-status.js";

export interface ImportLegacyInput {
  pat?: string;
  label?: string;
  projectRef?: string;
}

export async function importFromLegacySupabase(
  input: ImportLegacyInput = {},
): Promise<{
  account: Awaited<ReturnType<typeof addAccount>>;
  syncedProjects: Awaited<ReturnType<typeof syncProjectsForAccount>>;
  activeContext: Awaited<ReturnType<typeof setActiveContext>> | null;
  legacy: Awaited<ReturnType<typeof readLegacySupabaseMcpConfig>>;
}> {
  const legacy = await readLegacySupabaseMcpConfig();
  const pat =
    input.pat ??
    process.env["SUPABASE_ACCESS_TOKEN"] ??
    process.env["SUPABASE_PAT"] ??
    null;

  if (!pat) {
    throw new Error(
      "PAT não encontrado. Informe pat, SUPABASE_ACCESS_TOKEN ou SUPABASE_PAT.",
    );
  }

  const account = await addAccount({
    label: input.label ?? "default",
    pat,
  });

  const syncedProjects = await syncProjectsForAccount(account.id);

  const targetRef =
    input.projectRef ??
    legacy.projectRef ??
    syncedProjects[0]?.ref ??
    null;

  let activeContext = null;
  if (targetRef) {
    activeContext = await setActiveContext(account.id, targetRef);
  }

  return {
    account,
    syncedProjects,
    activeContext,
    legacy,
  };
}

export { getHubStatus, readLegacySupabaseMcpConfig };
