export class ManagementApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ManagementApiError";
  }
}

export interface SupabaseOrganization {
  id: string;
  slug: string;
  name: string;
}

export interface SupabaseProjectSummary {
  id: string;
  ref: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
}

export interface SupabaseApiKey {
  name: string;
  api_key: string;
  type: string;
}

export interface CreateProjectPayload {
  name: string;
  organizationSlug: string;
  dbPass: string;
  regionCode?: string;
}

const BASE_URL = "https://api.supabase.com/v1";

async function request<T>(
  pat: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new ManagementApiError(
      `Management API ${path} failed (${response.status})`,
      response.status,
      body,
    );
  }

  return body as T;
}

export async function listProjects(
  pat: string,
): Promise<SupabaseProjectSummary[]> {
  return request<SupabaseProjectSummary[]>(pat, "/projects");
}

export async function listOrganizations(
  pat: string,
): Promise<SupabaseOrganization[]> {
  return request<SupabaseOrganization[]>(pat, "/organizations");
}

export async function getProjectApiKeys(
  pat: string,
  projectRef: string,
): Promise<SupabaseApiKey[]> {
  return request<SupabaseApiKey[]>(pat, `/projects/${projectRef}/api-keys`);
}

export async function createProject(
  pat: string,
  input: CreateProjectPayload,
): Promise<SupabaseProjectSummary> {
  return request<SupabaseProjectSummary>(pat, "/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      organization_slug: input.organizationSlug,
      db_pass: input.dbPass,
      region_selection: {
        type: "smartGroup",
        code: input.regionCode ?? "americas",
      },
    }),
  });
}

export async function restoreProject(
  pat: string,
  projectRef: string,
): Promise<void> {
  await request<unknown>(pat, `/projects/${projectRef}/restore`, {
    method: "POST",
  });
}

export async function testPat(pat: string): Promise<boolean> {
  try {
    await listProjects(pat);
    return true;
  } catch {
    return false;
  }
}

export function resolveAnonKey(keys: SupabaseApiKey[]): string | null {
  const anon = keys.find(
    (key) =>
      key.type === "anon" ||
      key.name === "anon" ||
      key.name === "anon key" ||
      key.type === "legacy",
  );
  return anon?.api_key ?? null;
}

export function projectUrlFromRef(ref: string): string {
  return `https://${ref}.supabase.co`;
}
