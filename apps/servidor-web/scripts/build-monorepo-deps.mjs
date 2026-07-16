/**
 * Builds workspace packages that servidor-web imports via @mcps/* exports (dist/).
 * Required on Vercel: dist/ is gitignored, so Next cannot resolve subpath exports
 * until shared → openapi-engine → agent-os are built.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/servidor-web/scripts → monorepo root
const monorepoRoot = path.resolve(here, "../../..");

const result = spawnSync("npm", ["run", "build:packages"], {
  cwd: monorepoRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
