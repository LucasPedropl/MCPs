import { spawn } from "node:child_process";

/**
 * Mata um processo e toda a sua árvore de filhos.
 * No Windows, `child.kill()` mata só o wrapper (ex.: cmd.exe) e deixa o
 * processo real órfão — taskkill /t resolve isso.
 */
export function killProcessTree(pid: number | undefined | null): void {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true });
    } catch {
      // taskkill indisponível ou processo já morto
    }
    return;
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // já morreu
    }
  }
}

/** Normaliza separadores de path para POSIX (`\` → `/`). */
export function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}
