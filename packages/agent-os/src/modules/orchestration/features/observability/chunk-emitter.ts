import { appendJobEvent } from "../jobs/job-store.js";
import { sanitizeChunkText } from "./chunk-sanitizer.js";

export type ChunkHandler = (delta: string) => void | Promise<void>;

/** Emite eventos `chunk` incrementais para um job async (texto sanitizado). */
export function createJobChunkEmitter(jobId: string): ChunkHandler {
  let seq = 0;
  let accumulated = "";

  return async (delta: string) => {
    if (!delta) {
      return;
    }
    const sanitized = sanitizeChunkText(delta);
    seq += 1;
    accumulated += sanitized;
    await appendJobEvent(jobId, "chunk", {
      text: sanitized,
      seq,
      accumulatedLength: accumulated.length,
      sanitized: sanitized !== delta,
    });
  };
}

/** Emite apenas o crescimento de texto acumulado (útil para polling). */
export function createGrowingTextEmitter(onChunk: ChunkHandler): (fullText: string) => void {
  let lastLength = 0;

  return (fullText: string) => {
    if (fullText.length <= lastLength) {
      return;
    }
    const delta = fullText.slice(lastLength);
    lastLength = fullText.length;
    void onChunk(delta);
  };
}
