import { getAiAuthToken, fetchWithAuth } from './aiAuth';
import type { RecruiterContact } from '../types/recruiter';
import type { ConnectionRequest } from '../types/connection';
import type { IntroThread } from '../types/jill';

export interface ConnectionPreviewResult {
  recruiter: RecruiterContact;
  source: 'jill' | 'apify' | 'provided';
  recruiterUserId?: string;
  recruiterJobId?: string;
  narration: string;
  warmIntro: boolean;
}

export interface ConnectionRequestResult {
  connection: ConnectionRequest & { threadStatus?: string; jackNarration?: string; warmIntro?: boolean };
  recruiter: RecruiterContact;
  emailSent: boolean;
  emailError?: string;
  narration?: string;
  warmIntro?: boolean;
}

export async function previewConnectionRequest(input: {
  company: string;
  jobTitle: string;
  recruiterJobId?: string;
}): Promise<ConnectionPreviewResult> {
  const authToken = await getAiAuthToken();
  if (!authToken) throw new Error('Not authenticated');

  const response = await fetch('/api/connections/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Preview failed (${response.status})`);
  }
  return data as ConnectionPreviewResult;
}

export async function listCandidateIntros(): Promise<IntroThread[]> {
  const authToken = await getAiAuthToken();
  if (!authToken) throw new Error('Not authenticated');

  const response = await fetch('/api/connections/list', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Failed to load intros (${response.status})`);
  }
  return (data as { intros: IntroThread[] }).intros || [];
}

export async function sendConnectionRequest(input: {
  company: string;
  jobTitle: string;
  jobUrl?: string;
  trackedJobId?: string;
  introMessage?: string;
  recruiter?: RecruiterContact;
  recruiterJobId?: string;
  candidateAccepted?: boolean;
}): Promise<ConnectionRequestResult> {
  const authToken = await getAiAuthToken();
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/connections/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Connection request failed (${response.status})`);
  }

  return data as ConnectionRequestResult;
}

export async function lookupRecruiterViaApify(input: {
  company: string;
  jobTitle: string;
}): Promise<RecruiterContact> {
  const authToken = await getAiAuthToken();
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/apify/recruiter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Recruiter lookup failed (${response.status})`);
  }

  return (data as { recruiter: RecruiterContact }).recruiter;
}

export async function importLinkedInProfile(url: string): Promise<{
  profile: Record<string, unknown>;
  linkedinUrl: string;
}> {
  const response = await fetchWithAuth('/api/apify/linkedin-profile', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `LinkedIn import failed (${response.status})`);
  }

  return data as { profile: Record<string, unknown>; linkedinUrl: string };
}

export function linkedInConnectUrl(recruiterLinkedin?: string, note?: string): string | null {
  if (!recruiterLinkedin?.trim()) return null;
  const base = recruiterLinkedin.trim();
  if (!note?.trim()) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}utm_source=hireschema`;
}
