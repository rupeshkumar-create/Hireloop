import { getSupabaseAdmin } from '../supabaseAdmin.js';
import type { DailyJob } from '../../types/dailyJob.js';

export async function getDailyMatch(userId: string, matchDate: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('daily_matches')
    .select('jobs, meta')
    .eq('user_id', userId)
    .eq('match_date', matchDate)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    jobs: (data.jobs || []) as DailyJob[],
    meta: (data.meta || {}) as Record<string, unknown>,
  };
}

export async function setDailyMatch(
  userId: string,
  matchDate: string,
  jobs: DailyJob[],
  meta: Record<string, unknown>
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('daily_matches')
    .upsert(
      {
        user_id: userId,
        match_date: matchDate,
        jobs,
        meta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,match_date' }
    );

  if (error) throw error;
}

export async function listDailyMatchHistory(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('daily_matches')
    .select('match_date, jobs, meta, created_at')
    .eq('user_id', userId)
    .order('match_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/** Weekly market brief: aggregate recent daily_matches across users */
export async function queryDailyMatchesSince(sinceIso: string, limit = 500) {
  const { data, error } = await getSupabaseAdmin()
    .from('daily_matches')
    .select('user_id, match_date, jobs, meta, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
