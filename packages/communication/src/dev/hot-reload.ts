import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const DEBOUNCE_MS = 600;
const STARTUP_GRACE_MS = 3000;

function isRunningFromDist(moduleDir: string): boolean {
  const normalized = moduleDir.replace(/\\/g, "/");
  return /\/dist(?:\/|$)/.test(normalized);
}

/** Encerra o processo MCP ao detectar mudanças (dev). Chamar após server.connect(). */
export function enableHotReload(): void {
  if (process.env["BRIDGE_HOT_RELOAD"] !== "1") {
    return;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ready = false;

  setTimeout(() => {
    ready = true;
  }, STARTUP_GRACE_MS);

  const scheduleRestart = (label: string): void => {
    if (!ready) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      console.error(`[ide-bridge] hot-reload: ${label} — reiniciando…`);
      process.exit(0);
    }, DEBOUNCE_MS);
  };

  const watchDir = (dir: string, label: string): void => {
    if (!fs.existsSync(dir)) {
      console.error(`[ide-bridge] hot-reload: pasta não encontrada (${dir})`);
      return;
    }
    try {
      fs.watch(dir, { recursive: true }, (_event, filename) => {
        if (!filename) {
          return;
        }
        const normalized = filename.replace(/\\/g, "/");
        if (
          normalized.includes("node_modules/") ||
          normalized.includes("/dist/") ||
          !/\.(ts|tsx|json|js)$/.test(normalized)
        ) {
          return;
        }
        scheduleRestart(`${label}/${normalized}`);
      });
      console.error(`[ide-bridge] hot-reload ativo (watch: ${dir})`);
    } catch {
      console.error(`[ide-bridge] hot-reload: fs.watch recursivo indisponível em ${dir}`);
    }
  };

  if (isRunningFromDist(moduleDir)) {
    const bundle = path.join(moduleDir, "index.js");
    if (!fs.existsSync(bundle)) {
      console.error("[ide-bridge] hot-reload: dist/index.js não encontrado");
      return;
    }
    fs.watch(bundle, () => {
      scheduleRestart("dist/index.js atualizado");
    });
    console.error("[ide-bridge] hot-reload ativo (watch: dist/index.js — use npm run build:watch)");
    return;
  }

  const srcRoot = path.resolve(moduleDir, "..");
  watchDir(srcRoot, "src");
}
