import { requireApifyToken } from './apifyCareerSite.js';
import type { RecruiterContact } from '../../types/recruiter.js';

const ACTOR_ID = 'get-leads~linkedin-scraper';
const RUN_SYNC_ITEMS_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

const RECRUITER_TITLE_KEYWORDS = [
  'recruiter',
  'talent',
  'hiring',
  'people',
  'human resources',
  'hr ',
  'staffing',
  'acquisition',
  'sourcer',
  'talent partner',
];

export async function runApifyLinkedInScraper(
  input: Record<string, unknown>,
  token?: string
): Promise<Record<string, unknown>[]> {
  const apifyToken = requireApifyToken(token || process.env.APIFY_API_TOKEN);
  const url = new URL(RUN_SYNC_ITEMS_URL);
  url.searchParams.set('token', apifyToken);
  url.searchParams.set('timeout', '120');

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify LinkedIn scraper failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ''}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function scoreRecruiterMatch(record: Record<string, unknown>, company: string): number {
  const headline = pickString(record, ['headline', 'title', 'job_title', 'position']).toLowerCase();
  const companyField = pickString(record, ['company', 'current_company', 'currentCompany']).toLowerCase();
  const companyLower = company.toLowerCase();
  let score = 0;

  for (const keyword of RECRUITER_TITLE_KEYWORDS) {
    if (headline.includes(keyword)) score += 3;
  }

  if (companyLower && companyField.includes(companyLower)) score += 5;
  if (companyLower && headline.includes(companyLower)) score += 2;

  if (pickString(record, ['email'])) score += 2;
  if (pickString(record, ['url', 'linkedinUrl', 'linkedin_url', 'profileUrl'])) score += 1;

  return score;
}

export function normalizeApifyPerson(record: Record<string, unknown>): RecruiterContact | null {
  const name =
    pickString(record, ['name', 'fullName', 'full_name']) ||
    [pickString(record, ['firstName', 'first_name']), pickString(record, ['lastName', 'last_name'])]
      .filter(Boolean)
      .join(' ');

  const linkedinUrl = pickString(record, ['url', 'linkedinUrl', 'linkedin_url', 'profileUrl', 'profile_url']);
  const email = pickString(record, ['email', 'work_email', 'personal_email']);
  const title = pickString(record, ['headline', 'title', 'job_title', 'position']) || 'Recruiter';
  const company = pickString(record, ['company', 'current_company', 'currentCompany']);

  if (!name && !linkedinUrl) return null;
  if (!email && !linkedinUrl) return null;

  return {
    name: name || 'Hiring contact',
    title,
    email: email || undefined,
    linkedinUrl: linkedinUrl || undefined,
    company: company || undefined,
    source: 'apify',
  };
}

export async function findRecruiterViaApify(input: {
  company: string;
  jobTitle: string;
}): Promise<RecruiterContact | null> {
  const company = input.company.trim();
  if (!company) return null;

  const searchQuery = `${company} recruiter talent acquisition hiring manager`;
  const results = await runApifyLinkedInScraper({
    mode: 'search',
    searchQuery,
    maxResults: 15,
  });

  const ranked = results
    .map((row) => ({ row, score: scoreRecruiterMatch(row, company) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { row } of ranked) {
    const contact = normalizeApifyPerson(row);
    if (contact) return contact;
  }

  for (const row of results) {
    const contact = normalizeApifyPerson(row);
    if (contact) return contact;
  }

  return null;
}

export async function scrapeLinkedInProfileViaApify(profileUrl: string): Promise<Record<string, unknown> | null> {
  const results = await runApifyLinkedInScraper({
    mode: 'profiles',
    urls: [profileUrl],
    maxResults: 1,
  });

  return results[0] ?? null;
}
