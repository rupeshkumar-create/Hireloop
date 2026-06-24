import { getSupabaseAdmin } from '../supabaseAdmin.js';
import type { IntroThread, IntroThreadStatus } from '../../types/jill.js';

function rowToIntro(row: Record<string, unknown>): IntroThread {
  const data = (row.data || {}) as Record<string, unknown>;
  return {
    ...data,
    id: String(row.id),
    candidateUserId: String(row.candidate_user_id),
    recruiterUserId: row.recruiter_user_id ? String(row.recruiter_user_id) : null,
    recruiterJobId: row.recruiter_job_id ? String(row.recruiter_job_id) : null,
    candidateName: String(data.candidateName || ''),
    candidateEmail: String(data.candidateEmail || ''),
    jobTitle: String(data.jobTitle || ''),
    company: String(data.company || ''),
    recruiterName: String(data.recruiterName || ''),
    status: (data.status as IntroThread['status']) || 'pending',
    threadStatus: (data.threadStatus as IntroThreadStatus) || 'sent_to_recruiter',
    createdAt: String(data.createdAt || row.created_at),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  } as IntroThread;
}

export async function setConnectionRequest(
  id: string,
  candidateUserId: string,
  data: Record<string, unknown>,
  extras?: { recruiterUserId?: string | null; recruiterJobId?: string | null }
) {
  const row: Record<string, unknown> = {
    id,
    candidate_user_id: candidateUserId,
    data,
    created_at: data.createdAt || new Date().toISOString(),
  };
  if (extras?.recruiterUserId !== undefined) row.recruiter_user_id = extras.recruiterUserId;
  if (extras?.recruiterJobId !== undefined) row.recruiter_job_id = extras.recruiterJobId;

  const { error } = await getSupabaseAdmin().from('connection_requests').upsert(row);
  if (error) throw error;
}

export async function getConnectionRequest(id: string): Promise<IntroThread | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('connection_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToIntro(data as Record<string, unknown>) : null;
}

export async function listCandidateIntros(candidateUserId: string): Promise<IntroThread[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('connection_requests')
    .select('*')
    .eq('candidate_user_id', candidateUserId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((r) => rowToIntro(r as Record<string, unknown>));
}

export async function listRecruiterIntros(recruiterUserId: string): Promise<IntroThread[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('connection_requests')
    .select('*')
    .eq('recruiter_user_id', recruiterUserId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((r) => rowToIntro(r as Record<string, unknown>));
}

export async function updateIntroThread(
  id: string,
  patch: Partial<IntroThread> & { recruiterUserId?: string | null }
): Promise<IntroThread | null> {
  const existing = await getConnectionRequest(id);
  if (!existing) return null;

  const merged = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const row: Record<string, unknown> = {
    id,
    candidate_user_id: existing.candidateUserId,
    data: merged,
  };
  if (patch.recruiterUserId !== undefined) row.recruiter_user_id = patch.recruiterUserId;

  const { error } = await getSupabaseAdmin().from('connection_requests').upsert(row);
  if (error) throw error;
  return merged as IntroThread;
}
