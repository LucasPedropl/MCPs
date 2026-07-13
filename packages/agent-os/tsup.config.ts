import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/knowledge-only.ts",
    "src/projects-only.ts",
    "src/keepalive-worker-entry.ts",
    "src/hooks/hook-cli.ts",
  ],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  external: ["@mcps/openapi-engine"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
