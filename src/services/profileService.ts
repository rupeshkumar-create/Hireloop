import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { profileToRow, rowToProfile, type ProfileRow, type UserProfile } from '../lib/profileMapper';
import { stripUndefinedDeep } from '../lib/firestoreSanitizer';

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function updateProfile(userId: string, patch: Partial<UserProfile>): Promise<void> {
  const clean = stripUndefinedDeep(patch) as Partial<UserProfile>;
  const mapped = profileToRow(userId, clean);
  const dataPatch = (mapped.data || {}) as Record<string, unknown>;

  const { data: existingRow } = await getSupabaseBrowserClient()
    .from('profiles')
    .select('data')
    .eq('id', userId)
    .maybeSingle();

  const mergedData = { ...(existingRow?.data || {}), ...dataPatch };
  const row: Record<string, unknown> = {
    id: userId,
    data: mergedData,
    updated_at: new Date().toISOString(),
  };

  if (mapped.email !== undefined) row.email = mapped.email;
  if (mapped.display_name !== undefined) row.display_name = mapped.display_name;
  if (mapped.photo_url !== undefined) row.photo_url = mapped.photo_url;
  if (mapped.plan !== undefined) row.plan = mapped.plan;
  if (mapped.receive_daily_alerts !== undefined) row.receive_daily_alerts = mapped.receive_daily_alerts;
  if (mapped.last_job_fetch_time !== undefined) row.last_job_fetch_time = mapped.last_job_fetch_time;
  if (mapped.next_job_delivery_at !== undefined) row.next_job_delivery_at = mapped.next_job_delivery_at;

  const { error } = await getSupabaseBrowserClient()
    .from('profiles')
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
}

export function subscribeToProfile(
  userId: string,
  onProfile: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = getSupabaseBrowserClient();

  const load = async () => {
    try {
      const profile = await fetchProfile(userId);
      onProfile(profile);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  void load();

  const channel = supabase
    .channel(`profile:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onProfile(null);
          return;
        }
        const row = payload.new as ProfileRow;
        onProfile(rowToProfile(row));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export type { UserProfile };
