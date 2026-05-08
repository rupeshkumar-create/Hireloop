import { ApifyCareerSiteItem, NormalizedApifyJob, pickString, pickStringArray } from './apifyCareerSite';

export type ApifyLinkedInInput = {
  keyword: string;
  location: string;
  f_WT?: string; // e.g. '2' for remote
  f_TPR?: string; // e.g. 'r604800' for past 7 days
  limit: number;
};

const ACTOR_ID = 'bebity~linkedin-jobs-scraper';
const RUN_SYNC_ITEMS_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

export async function runLinkedInActor(input: ApifyLinkedInInput, token: string): Promise<ApifyCareerSiteItem[]> {
  const url = new URL(RUN_SYNC_ITEMS_URL);
  url.searchParams.set('token', token);
  
  // Create an array of queries for the scraper
  const body = {
    queries: [input],
    limit: input.limit
  };

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify LinkedIn Actor failed with HTTP ${response.status}${text ? ': ' + text : ''}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

export function normalizeLinkedInItem(item: ApifyCareerSiteItem): NormalizedApifyJob | null {
  const record = item as Record<string, unknown>;
  const title = pickString(record, ['title', 'jobTitle', 'position']);
  const company = pickString(record, ['company', 'companyName']);
  const location = pickString(record, ['location', 'jobLocation']);
  const description = pickString(record, ['description', 'jobDescription', 'text']);
  const applyUrl = pickString(record, ['jobUrl', 'applyUrl', 'url', 'linkedinUrl']);
  const postedAt = pickString(record, ['postedAt', 'datePosted', 'publishedAt']);
  
  // Scraper might not return exact requirements/salary easily
  const salary = pickString(record, ['salary', 'compensation']);
  const requirements = pickStringArray(record, ['requirements', 'skills', 'requiredSkills']);
  const workTypeHint = pickString(record, ['workplaceType', 'workType']);

  if (!title || !company || !description || description.length < 30 || !applyUrl.startsWith('http')) return null;

  return {
    jobId: pickString(record, ['id', 'jobId', 'job_id']) || `${title}::${company}`,
    title,
    company,
    location: location || 'Remote',
    description,
    applyUrl,
    postedAt: postedAt || new Date().toISOString(),
    salary,
    salaryMin: null,
    salaryMax: null,
    logoUrl: pickString(record, ['logoUrl', 'companyLogo', 'logo']),
    aiDescriptionEnriched: '',
    atsDuplicate: false,
    requirements,
    workTypeHint: workTypeHint || 'Remote', // Often pre-filtered to remote
  };
}
