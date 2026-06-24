import { getSupabaseAdmin } from '../supabaseAdmin.js';
import type { UserProfile } from '../../lib/profileMapper.js';
import { profileToRow, rowToProfile, type ProfileRow } from '../../lib/profileMapper.js';

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function upsertProfile(userId: string, patch: Partial<UserProfile>, merge = true): Promise<void> {
  const mapped = profileToRow(userId, patch);
  const dataPatch = (mapped.data || {}) as Record<string, unknown>;

  let mergedData = dataPatch;
  if (merge) {
    const { data: existingRow } = await getSupabaseAdmin()
      .from('profiles')
      .select('data')
      .eq('id', userId)
      .maybeSingle();
    mergedData = { ...(existingRow?.data || {}), ...dataPatch };
  }

  const row: Record<string, unknown> = {
    id: userId,
    data: mergedData,
    updated_at: new Date().toISOString(),
  };

  if (mapped.email !== undefined) row.email = mapped.email;
  if (mapped.display_name !== undefined) row.display_name = mapped.display_name;
  if (mapped.photo_url !== undefined) row.photo_url = mapped.photo_url;
  if (mapped.plan !== undefined) row.plan = mapped.plan;
  if (mapped.role !== undefined) row.role = mapped.role;
  if (mapped.receive_daily_alerts !== undefined) row.receive_daily_alerts = mapped.receive_daily_alerts;
  if (mapped.last_job_fetch_time !== undefined) row.last_job_fetch_time = mapped.last_job_fetch_time;
  if (mapped.next_job_delivery_at !== undefined) row.next_job_delivery_at = mapped.next_job_delivery_at;

  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
}

export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

export async function listProfilesDueForDelivery(beforeIso: string, limit: number) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('receive_daily_alerts', true)
    .lte('next_job_delivery_at', beforeIso)
    .order('next_job_delivery_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id as string,
    data: rowToProfile(row as ProfileRow) as Record<string, unknown>,
  }));
}

export async function findProfilesByEmail(email: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .ilike('email', email);

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id as string,
    data: rowToProfile(row as ProfileRow),
  }));
}

export async function listProfiles(limit: number) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id as string,
    data: rowToProfile(row as ProfileRow),
  }));
}

export async function listProfilesPaginated(limit: number, offset = 0) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id as string,
    data: rowToProfile(row as ProfileRow) as Record<string, unknown>,
  }));
}
