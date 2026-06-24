import { getSupabaseAdmin } from '../supabaseAdmin.js';

export async function getCronRun(runId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('cron_runs')
    .select('data')
    .eq('id', runId)
    .maybeSingle();

  if (error) throw error;
  return data ? { exists: true, data: data.data as Record<string, unknown> } : { exists: false, data: null };
}

export async function setCronRun(runId: string, patch: Record<string, unknown>, merge = true): Promise<void> {
  const existing = merge ? await getCronRun(runId) : { exists: false, data: null };
  const data = merge && existing.data ? { ...existing.data, ...patch } : patch;
  const userId = typeof data.userId === 'string' ? data.userId : null;

  const { error } = await getSupabaseAdmin()
    .from('cron_runs')
    .upsert(
      {
        id: runId,
        user_id: userId,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

export async function createCronRunIfAbsent(runId: string, record: Record<string, unknown>): Promise<boolean> {
  const existing = await getCronRun(runId);
  if (existing.exists) return false;
  await setCronRun(runId, record, false);
  return true;
}
