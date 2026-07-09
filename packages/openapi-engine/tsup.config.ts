import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/lib.ts", "src/cli.ts", "src/sync-only.ts", "src/qa-only.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
});
