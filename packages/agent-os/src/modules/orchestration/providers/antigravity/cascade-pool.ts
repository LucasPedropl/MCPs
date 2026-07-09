import { getAntigravityMaxConcurrent } from "./config.js";

let active = 0;
const waitQueue: Array<() => void> = [];

function releaseSlot(): void {
  active = Math.max(0, active - 1);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

function acquireSlot(): Promise<void> {
  const max = getAntigravityMaxConcurrent();
  if (active < max) {
    active += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    waitQueue.push(() => {
      active += 1;
      resolve();
    });
  });
}

/** Limita cascades subagent concorrentes na mesma instância (sem UI extra). */
export async function withCascadeSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

export function getCascadePoolStats(): { active: number; queued: number; max: number } {
  return {
    active,
    queued: waitQueue.length,
    max: getAntigravityMaxConcurrent(),
  };
}
