import type { DiscoveredJob } from '../jobResearcher.js';
import { jobFingerprint } from '../jobResearcher.js';
import { extractGreenhouseToken } from './atsAllowlist.js';

type GreenhouseApiJob = {
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  created_at?: string;
  location?: { name?: string };
  content?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isRemoteLocationStrict(location: string): boolean {
  return /\bremote\b/i.test(location);
}

export function normaliseGreenhouseJob(companyName: string, raw: GreenhouseApiJob): DiscoveredJob | null {
  const title = (raw.title || '').trim();
  const location = (raw.location?.name || '').trim();
  const applyUrl = (raw.absolute_url || '').trim();
  const postedAt = (raw.updated_at || raw.created_at || new Date().toISOString()).toString();
  const description = stripHtml(String(raw.content || '')).slice(0, 4000);

  if (!title || !companyName || !applyUrl) return null;
  if (!location || !isRemoteLocationStrict(location)) return null;
  if (description.length < 80) return null;

  return {
    fingerprint: jobFingerprint(title, companyName),
    title,
    company: companyName,
    location,
    workType: 'remote',
    salary: '',
    description,
    requirements: [],
    source: 'ats-greenhouse' as any,
    applyUrl,
    postedAt,
    daysOld: 0,
  };
}

export async function fetchGreenhouseJobs(
  boardUrl: string,
  companyName: string,
  fetchFn: typeof fetch
): Promise<DiscoveredJob[]> {
  const token = extractGreenhouseToken(boardUrl);
  if (!token) return [];
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  const res = await fetchFn(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray((data as any).jobs) ? (data as any).jobs : [];
  return jobs
    .map((j: any) => normaliseGreenhouseJob(companyName, j))
    .filter((j): j is DiscoveredJob => Boolean(j));
}
