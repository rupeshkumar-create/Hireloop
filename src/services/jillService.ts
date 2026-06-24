import { getAiAuthToken } from './aiAuth';
import type { RecruiterJob, RecruiterProfile } from '../types/jill';
import type { IntroThread } from '../types/jill';

async function jillFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = await getAiAuthToken();
  if (!authToken) throw new Error('Not authenticated');

  const response = await fetch(`/api/jill/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Jill API failed (${response.status})`);
  }
  return data as T;
}

export async function fetchJillProfile(): Promise<{ profile: RecruiterProfile | null }> {
  return jillFetch('profile', { method: 'GET' });
}

export async function saveJillProfile(input: Partial<RecruiterProfile>): Promise<{ profile: RecruiterProfile }> {
  return jillFetch('profile', { method: 'POST', body: JSON.stringify(input) });
}

export async function fetchJillJobs(): Promise<{ jobs: RecruiterJob[] }> {
  return jillFetch('jobs', { method: 'GET' });
}

export async function createJillJob(input: {
  title: string;
  company: string;
  location?: string;
  salaryRange?: string;
  description: string;
  requirements?: string[] | string;
}): Promise<{ job: RecruiterJob }> {
  return jillFetch('jobs', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateJillJob(
  jobId: string,
  patch: Partial<RecruiterJob>
): Promise<{ job: RecruiterJob }> {
  return jillFetch(`jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function fetchJillIntros(): Promise<{ intros: IntroThread[] }> {
  return jillFetch('intros', { method: 'GET' });
}

export async function respondToIntro(
  introId: string,
  action: 'accept' | 'decline' | 'schedule'
): Promise<{ intro: IntroThread }> {
  return jillFetch(`intros/${introId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}
