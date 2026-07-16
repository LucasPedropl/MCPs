import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * turbopackIgnore: avoid NFT tracing the whole monorepo from process.cwd()/../..
 * Prefer explicit env on Vercel when these paths are needed at runtime.
 */
export function getMonorepoRoot(): string {
  const fromEnv = process.env.AGENT_OS_MONOREPO_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
}

export function getPresetsPath(): string {
  const custom = process.env.AGENT_OS_PRESETS_PATH;
  if (custom) return path.resolve(custom);
  return path.join(
    getMonorepoRoot(),
    "packages",
    "agent-os",
    "presets",
    "mcp-presets.json",
  );
}

export function getSupabaseHubConfigPath(): string {
  const dir =
    process.env.SUPABASE_HUB_CONFIG_DIR ??
    path.join(os.homedir(), ".supabase-mcp-hub");
  return path.join(dir, "config.json");
}

export function getOpenApiEnginePath(): string {
  const fromEnv = process.env.AGENT_OS_OPENAPI_ENGINE_PATH;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(
    getMonorepoRoot(),
    "packages",
    "openapi-engine",
    "dist",
    "index.js",
  );
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildOpenApiAlias(server: { id: string; name: string }): string {
  const slug = slugify(server.name);
  return slug ? `openapi-${slug}` : `openapi-${server.id.slice(0, 8)}`;
}

export function buildOpenApiHubConfig(serverId: string): Record<string, unknown> {
  const apiPath = getOpenApiEnginePath();
  if (!fs.existsSync(apiPath)) {
    throw new Error(
      `openapi-engine não compilado: ${apiPath}. Rode npm run build:openapi-engine.`,
    );
  }

  return {
    server_id: serverId,
    engine: "openapi-engine",
    command: "node",
    args: [apiPath.replace(/\\/g, "/"), "--serverId", serverId],
  };
}
