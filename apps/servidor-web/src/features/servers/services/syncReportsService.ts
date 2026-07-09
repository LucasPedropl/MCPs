import { supabase } from '@/lib/supabase';

export interface SyncReportRecord {
  id: string;
  server_id: string;
  report_summary: string;
  added_endpoints: unknown[];
  modified_endpoints: unknown[];
  removed_endpoints: unknown[];
  created_at: string;
}

export async function fetchSyncReportsService(
  serverId: string,
  limit = 20,
): Promise<SyncReportRecord[]> {
  const { data, error } = await supabase
    .from('mcp_sync_reports')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || 'Falha ao buscar relatórios de sincronização.');
  }

  return (data || []) as SyncReportRecord[];
}
