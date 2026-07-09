import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { envFirst, getAgentOsConfigDir } from "./env.js";

function walkUp(findMatch: (dir: string) => boolean): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 10; depth += 1) {
    if (findMatch(dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

/** Monorepo root (folder with skills/ and packages/). */
export function getMonorepoRoot(): string {
  const fromEnv = envFirst("AGENT_OS_MONOREPO_ROOT");
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const found = walkUp(
    (dir) =>
      fs.existsSync(path.join(dir, "skills", "pedro-defaults", "SKILL.md")) ||
      fs.existsSync(path.join(dir, "packages", "agent-os")),
  );

  return found ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

/** Canonical skills/ directory at monorepo root. */
export function getSkillsRoot(): string {
  const fromEnv = envFirst("AGENT_OS_SKILLS_ROOT");
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  return path.join(getMonorepoRoot(), "skills");
}

/** @mcps/agent-os package root (presets/, package.json). */
export function getAgentOsPackageRoot(): string {
  const fromEnv = envFirst("AGENT_OS_PACKAGE_ROOT");
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const found = walkUp((dir) =>
    fs.existsSync(path.join(dir, "presets", "mcp-presets.json")),
  );

  return found ?? path.join(getMonorepoRoot(), "packages", "agent-os");
}

export function getOpenApiEngineEntryPath(): string {
  const fromEnv = envFirst("AGENT_OS_OPENAPI_ENGINE_PATH");
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  return path.join(getMonorepoRoot(), "packages", "openapi-engine", "dist", "index.js");
}

/** @deprecated Use getOpenApiEngineEntryPath — servidor-api removido */
export function getServidorApiEntryPath(): string {
  return getOpenApiEngineEntryPath();
}

export function getPresetsPath(): string {
  const fromEnv = envFirst("AGENT_OS_PRESETS_PATH");
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const custom = path.join(getAgentOsConfigDir(), "presets.json");
  if (fs.existsSync(custom)) {
    return custom;
  }

  return path.join(getAgentOsPackageRoot(), "presets", "mcp-presets.json");
}
