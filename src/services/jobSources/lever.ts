import type { DiscoveredJob } from '../jobResearcher';
import { jobFingerprint } from '../jobResearcher';
import { extractLeverToken } from './atsAllowlist';
import { isRemoteLocationStrict } from './greenhouse';

type LeverPosting = {
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  categories?: { location?: string };
  descriptionPlain?: string;
  description?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseLeverPosting(companyName: string, raw: LeverPosting): DiscoveredJob | null {
  const title = (raw.text || '').trim();
  const location = (raw.categories?.location || '').trim();
  const applyUrl = (raw.hostedUrl || '').trim();
  const postedAt = raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
  const descriptionSource =
    typeof raw.descriptionPlain === 'string' && raw.descriptionPlain.trim().length > 0
      ? raw.descriptionPlain
      : stripHtml(String(raw.description || ''));
  const description = descriptionSource.trim().slice(0, 4000);

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
    source: 'ats-lever' as any,
    applyUrl,
    postedAt,
    daysOld: 0,
  };
}

export async function fetchLeverJobs(
  boardUrl: string,
  companyName: string,
  fetchFn: typeof fetch
): Promise<DiscoveredJob[]> {
  const token = extractLeverToken(boardUrl);
  if (!token) return [];
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
  const res = await fetchFn(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  const postings = Array.isArray(data) ? data : [];
  return postings
    .map((p: any) => normaliseLeverPosting(companyName, p))
    .filter((j): j is DiscoveredJob => Boolean(j));
}

