import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { enqueueJob } from "./job-runner.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status operacional do realtime worker. */
export interface RealtimeWorkerStatus {
  running: boolean;
  channelState: string | null;
  supabaseConfigured: boolean;
  startedAt: string | null;
  jobsDispatched: number;
}

/** Payload mínimo recebido no INSERT da tabela delegation_jobs. */
interface RealtimeJobInsertPayload {
  id?: string;
  status?: string;
  provider?: string;
  workspace?: string;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let channel: RealtimeChannel | null = null;
let running = false;
let startedAt: string | null = null;
let jobsDispatched = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Verifica se o worker está ativo. */
export function isRealtimeWorkerRunning(): boolean {
  return running;
}

/** Retorna snapshot do status do worker. */
export function getRealtimeWorkerStatus(): RealtimeWorkerStatus {
  return {
    running,
    channelState: channel ? String(channel.state) : null,
    supabaseConfigured: isSupabaseConfigured(),
    startedAt,
    jobsDispatched,
  };
}

/**
 * Inicia worker event-driven via Supabase Realtime.
 *
 * Faz subscribe em `postgres_changes` (INSERT) na tabela `delegation_jobs`.
 * Quando um novo job com status `pending` é inserido, chama `enqueueJob`
 * automaticamente para processamento imediato.
 *
 * @returns `true` se o subscribe foi iniciado, `false` se já rodando,
 *          Supabase não configurado ou desabilitado via env.
 */
export function startRealtimeWorker(): boolean {
  if (running) {
    console.error("[realtime-worker] já está rodando — ignorando start duplicado");
    return false;
  }

  if (!isSupabaseConfigured()) {
    console.error("[realtime-worker] Supabase não configurado — worker não iniciado");
    return false;
  }

  if (process.env["BRIDGE_REALTIME_WORKER"] === "0") {
    console.error("[realtime-worker] desabilitado via BRIDGE_REALTIME_WORKER=0");
    return false;
  }

  try {
    const client = getSupabaseClient();

    channel = client
      .channel("delegation_jobs_worker")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delegation_jobs",
          filter: "status=eq.pending",
        },
        (payload) => {
          handleInsertEvent(payload.new as RealtimeJobInsertPayload);
        },
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          running = true;
          startedAt = new Date().toISOString();
          console.error(
            `[realtime-worker] inscrito em delegation_jobs INSERT (${startedAt})`,
          );
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const errorMessage = error instanceof Error ? error.message : String(error ?? "unknown");
          console.error(
            `[realtime-worker] channel error (${status}): ${errorMessage}`,
          );
          running = false;
        }

        if (status === "CLOSED") {
          running = false;
          console.error("[realtime-worker] channel fechado");
        }
      });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[realtime-worker] falha ao iniciar: ${message}`);
    return false;
  }
}

/** Para o worker e desinscreve do channel. */
export function stopRealtimeWorker(): void {
  if (channel) {
    void channel.unsubscribe();
    channel = null;
  }

  running = false;
  startedAt = null;
  console.error("[realtime-worker] parado");
}

/** Reseta contadores internos (útil para testes). */
export function resetRealtimeWorkerStats(): void {
  jobsDispatched = 0;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Processa evento INSERT recebido do Supabase Realtime. */
function handleInsertEvent(row: RealtimeJobInsertPayload): void {
  if (!row.id) {
    console.error("[realtime-worker] INSERT sem id — ignorando");
    return;
  }

  if (row.status !== "pending") {
    return;
  }

  console.error(
    `[realtime-worker] novo job pending detectado: ${row.id} (provider: ${row.provider ?? "?"})`,
  );

  jobsDispatched += 1;
  enqueueJob(row.id);
}
