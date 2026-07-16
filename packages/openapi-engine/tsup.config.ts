import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/lib.ts", "src/cli.ts", "src/sync-only.ts", "src/qa-only.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // package.json aponta types para dist/lib.d.ts — sem isso os consumidores
  // (agent-os) veem o pacote como any.
  dts: { entry: { lib: "src/lib.ts" } },
  sourcemap: true,
});
