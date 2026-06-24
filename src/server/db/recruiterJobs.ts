import { getSupabaseAdmin } from '../supabaseAdmin.js';
import type { RecruiterJob, RecruiterProfile } from '../../types/jill.js';

function rowToRecruiterProfile(row: Record<string, unknown>): RecruiterProfile {
  return {
    userId: String(row.user_id),
    companyName: String(row.company_name),
    companyWebsite: row.company_website ? String(row.company_website) : undefined,
    title: row.title ? String(row.title) : undefined,
    bio: row.bio ? String(row.bio) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function rowToRecruiterJob(row: Record<string, unknown>): RecruiterJob {
  const reqs = row.requirements;
  return {
    id: String(row.id),
    recruiterUserId: String(row.recruiter_user_id),
    title: String(row.title),
    company: String(row.company),
    location: String(row.location || 'Remote'),
    salaryRange: row.salary_range ? String(row.salary_range) : undefined,
    description: String(row.description || ''),
    requirements: Array.isArray(reqs) ? reqs.map(String) : [],
    status: (row.status as RecruiterJob['status']) || 'open',
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function getRecruiterProfile(userId: string): Promise<RecruiterProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('recruiter_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecruiterProfile(data as Record<string, unknown>) : null;
}

export async function upsertRecruiterProfile(userId: string, patch: Partial<RecruiterProfile>) {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (patch.companyName !== undefined) row.company_name = patch.companyName;
  if (patch.companyWebsite !== undefined) row.company_website = patch.companyWebsite;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.bio !== undefined) row.bio = patch.bio;

  const { error } = await getSupabaseAdmin().from('recruiter_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function listRecruiterJobs(recruiterUserId: string): Promise<RecruiterJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('recruiter_jobs')
    .select('*')
    .eq('recruiter_user_id', recruiterUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => rowToRecruiterJob(r as Record<string, unknown>));
}

export async function listOpenRecruiterJobs(limit = 50): Promise<RecruiterJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('recruiter_jobs')
    .select('*, profiles:recruiter_user_id(email, display_name, data)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || []).map((row) => {
    const job = rowToRecruiterJob(row as Record<string, unknown>);
    const prof = (row as { profiles?: { email?: string; display_name?: string; data?: { displayName?: string } } }).profiles;
    job.recruiterName = prof?.display_name || prof?.data?.displayName || prof?.email?.split('@')[0];
    job.recruiterEmail = prof?.email;
    return job;
  });
}

export async function getRecruiterJob(id: string): Promise<RecruiterJob | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('recruiter_jobs')
    .select('*, profiles:recruiter_user_id(email, display_name, data)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const job = rowToRecruiterJob(data as Record<string, unknown>);
  const prof = (data as { profiles?: { email?: string; display_name?: string; data?: { displayName?: string } } }).profiles;
  job.recruiterName = prof?.display_name || prof?.data?.displayName;
  job.recruiterEmail = prof?.email;
  return job;
}

export async function createRecruiterJob(
  recruiterUserId: string,
  input: Omit<RecruiterJob, 'id' | 'recruiterUserId' | 'createdAt' | 'updatedAt'>
) {
  const { data, error } = await getSupabaseAdmin()
    .from('recruiter_jobs')
    .insert({
      recruiter_user_id: recruiterUserId,
      title: input.title,
      company: input.company,
      location: input.location || 'Remote',
      salary_range: input.salaryRange || null,
      description: input.description,
      requirements: input.requirements || [],
      status: input.status || 'open',
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToRecruiterJob(data as Record<string, unknown>);
}

export async function updateRecruiterJob(
  recruiterUserId: string,
  jobId: string,
  patch: Partial<Pick<RecruiterJob, 'title' | 'company' | 'location' | 'salaryRange' | 'description' | 'requirements' | 'status'>>
) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.company !== undefined) row.company = patch.company;
  if (patch.location !== undefined) row.location = patch.location;
  if (patch.salaryRange !== undefined) row.salary_range = patch.salaryRange;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.requirements !== undefined) row.requirements = patch.requirements;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await getSupabaseAdmin()
    .from('recruiter_jobs')
    .update(row)
    .eq('id', jobId)
    .eq('recruiter_user_id', recruiterUserId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecruiterJob(data as Record<string, unknown>) : null;
}

export async function findJillJobMatch(company: string, jobTitle: string): Promise<RecruiterJob | null> {
  const jobs = await listOpenRecruiterJobs(100);
  const c = company.toLowerCase().trim();
  const t = jobTitle.toLowerCase().trim();
  return (
    jobs.find((j) => j.company.toLowerCase() === c && j.title.toLowerCase() === t) ||
    jobs.find((j) => j.company.toLowerCase().includes(c) || c.includes(j.company.toLowerCase())) ||
    null
  );
}
