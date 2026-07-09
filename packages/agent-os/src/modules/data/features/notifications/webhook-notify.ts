import type { PingResult } from "../projects/services/keepalive-service.js";

export interface WebhookPayload {
  event: string;
  projectRef?: string;
  accountId?: string;
  url?: string;
  error?: string;
  latencyMs?: number;
  timestamp: string;
  failedCount?: number;
  results?: PingResult[];
}

/** Sends a webhook notification to the given URL. Errors are logged, never thrown. */
export async function notifyWebhook(
  url: string,
  payload: WebhookPayload,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(`[webhook] POST ${url} returned ${response.status}`);
    }
    return response.ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[webhook] notify failed: ${message}`);
    return false;
  }
}

/** Returns the configured webhook URL, or null if unset. */
export function getWebhookUrl(): string | null {
  return process.env["SUPABASE_HUB_WEBHOOK_URL"] ?? null;
}

/**
 * Sends a batch webhook notification for failed keep-alive pings.
 * No-op if SUPABASE_HUB_WEBHOOK_URL is not set or no failures.
 */
export async function notifyFailedPings(
  failedResults: PingResult[],
): Promise<boolean | null> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl || failedResults.length === 0) {
    return null;
  }

  const payload: WebhookPayload = {
    event: "keepalive.ping_failed",
    timestamp: new Date().toISOString(),
    failedCount: failedResults.length,
    results: failedResults,
  };

  return notifyWebhook(webhookUrl, payload);
}
