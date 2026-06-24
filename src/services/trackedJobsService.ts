import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { TrackedJob } from '../lib/trackedJob';

type TrackedJobRow = {
  id: string;
  user_id: string;
  title: string;
  company: string;
  status: string;
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
};

const TRACKED_COLUMNS = new Set(['id', 'userId', 'title', 'company', 'status', 'createdAt', 'updatedAt']);

function rowToTrackedJob(row: TrackedJobRow): TrackedJob {
  const data = row.data || {};
  return {
    ...(data as unknown as TrackedJob),
    id: row.id,
    userId: row.user_id,
    title: row.title,
    company: row.company,
    status: row.status as TrackedJob['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    location: (data.location as string) || '',
    salary: (data.salary as string) || '',
    url: (data.url as string) || '',
    notes: (data.notes as string) || '',
  };
}

function trackedJobToRow(job: Partial<TrackedJob> & { userId: string }) {
  const data: Record<string, unknown> = {};
  const row: Record<string, unknown> = {
    user_id: job.userId,
    title: job.title,
    company: job.company,
    status: job.status,
  };

  for (const [key, value] of Object.entries(job)) {
    if (value === undefined) continue;
    if (TRACKED_COLUMNS.has(key)) {
      if (key === 'userId' || key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
      row[key] = value;
    } else {
      data[key] = value;
    }
  }

  row.data = data;
  return row;
}

export async function fetchTrackedJobs(userId: string): Promise<TrackedJob[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('tracked_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => rowToTrackedJob(row as TrackedJobRow));
}

export function subscribeTrackedJobs(
  userId: string,
  callback: (jobs: TrackedJob[]) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = getSupabaseBrowserClient();

  const load = async () => {
    try {
      const jobs = await fetchTrackedJobs(userId);
      callback(jobs);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  void load();

  const channel = supabase
    .channel(`tracked_jobs:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tracked_jobs', filter: `user_id=eq.${userId}` },
      () => {
        void load();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function createTrackedJob(
  job: Omit<TrackedJob, 'id'> & { id?: string }
): Promise<string> {
  const row = trackedJobToRow(job);
  const { data, error } = await getSupabaseBrowserClient()
    .from('tracked_jobs')
    .insert(row)
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateTrackedJob(
  jobId: string,
  userId: string,
  patch: Partial<TrackedJob>
): Promise<void> {
  const { data: existing, error: readError } = await getSupabaseBrowserClient()
    .from('tracked_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) throw new Error('Tracked job not found');

  const merged = { ...rowToTrackedJob(existing as TrackedJobRow), ...patch, userId };
  const row = trackedJobToRow(merged);
  row.updated_at = new Date().toISOString();

  const { error } = await getSupabaseBrowserClient()
    .from('tracked_jobs')
    .update(row)
    .eq('id', jobId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteTrackedJob(jobId: string, userId: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from('tracked_jobs')
    .delete()
    .eq('id', jobId)
    .eq('user_id', userId);

  if (error) throw error;
}
