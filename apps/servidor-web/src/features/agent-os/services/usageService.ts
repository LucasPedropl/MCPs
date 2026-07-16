import type { UsageDays, UsageHostFilter, UsagePayload } from '../types/usage';

export async function fetchUsageStats(params: {
  days: UsageDays;
  host: UsageHostFilter;
}): Promise<UsagePayload> {
  const search = new URLSearchParams({ days: String(params.days), limit: '20' });
  if (params.host) {
    search.set('host', params.host);
  }

  const response = await fetch(`/api/agent-os/usage?${search.toString()}`);
  const payload = (await response.json()) as UsagePayload;
  if (!response.ok) {
    throw new Error(payload.message ?? `HTTP ${response.status}`);
  }
  return payload;
}
