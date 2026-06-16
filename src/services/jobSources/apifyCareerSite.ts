export type ApifyTimeRange = '1h' | '24h' | '7d' | '6m';
export type ApifyDescriptionType = 'text' | 'html';
export type ApifyAts =
  | 'greenhouse'
  | 'lever.co'
  | 'ashby'
  | 'workday'
  | 'workable'
  | 'smartrecruiters'
  | 'icims'
  | 'successfactors'
  | 'personio'
  | 'jobvite'
  | 'taleo'
  | 'other';

export type ApifyWorkArrangement = 'On-site' | 'Hybrid' | 'Remote OK' | 'Remote Solely';

export type ApifyCareerSiteInput = {
  timeRange: ApifyTimeRange;
  limit: number;
  includeAi: boolean;
  descriptionType: ApifyDescriptionType;
  ats?: string[];
  titleSearch?: string[];
  titleExclusionSearch?: string[];
  descriptionSearch?: string[];
  descriptionExclusionSearch?: string[];
  organizationSearch?: string[];
  organizationExclusionSearch?: string[];
  locationSearch?: string[];
  locationExclusionSearch?: string[];
  aiWorkArrangementFilter?: ApifyWorkArrangement[];
  includeLinkedIn?: boolean;
  aiHasSalary?: boolean;
  aiVisaSponsorshipFilter?: boolean;
  populateAiRemoteLocation?: boolean;
  populateAiRemoteLocationDerived?: boolean;
  removeAgency?: boolean;
  remoteOnly?: boolean;
};

export type ApifyCareerSiteItem = Record<string, unknown>;

const ACTOR_ID = 'fantastic-jobs~career-site-job-listing-api';
const RUN_SYNC_ITEMS_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

export function requireApifyToken(token: string | undefined): string {
  let value = (token || '').trim();
  
  // Robustly handle tokens that might be wrapped in quotes from .env files
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).trim();
  }
  
  if (!value) {
    throw new Error('Server Configuration Error: Missing APIFY_API_TOKEN environment variable.');
  }
  return value;
}

export async function runCareerSiteActor(input: ApifyCareerSiteInput, token: string, timeoutMs = 50_000): Promise<ApifyCareerSiteItem[]> {
  const url = new URL(RUN_SYNC_ITEMS_URL);
  url.searchParams.set('token', token);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Apify Actor failed with HTTP ${response.status}${text ? ': ' + text : ''}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Apify Actor timed out after ${timeoutMs / 1000}s — configure GITHUB_DISPATCH_TOKEN + GITHUB_REPO in Vercel for async job generation.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
    }
  }
  return '';
}

export function pickNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    let value = item[key];
    if (Array.isArray(value) && value.length > 0) value = value[0];
    
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

export function pickStringArray(item: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      const strings = value.filter((v) => typeof v === 'string').map((v) => (v as string).trim()).filter(Boolean);
      if (strings.length > 0) return strings;
    }
  }
  return [];
}

export type NormalizedApifyJob = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  postedAt: string;
  salary: string;
  salaryMin: number | null;
  salaryMax: number | null;
  logoUrl: string;
  aiDescriptionEnriched: string;
  atsDuplicate: boolean;
  workTypeHint: string;
  requirements: string[];
};

export function normalizeApifyItem(item: ApifyCareerSiteItem): NormalizedApifyJob | null {
  const record = item as Record<string, unknown>;
  const jobId = pickString(record, ['job_id', 'id', 'fingerprint']);
  const title = pickString(record, ['job_title', 'title', 'jobTitle', 'positionTitle', 'name', 'positionName']);
  const company = pickString(record, ['company_name', 'company', 'organization', 'organizationName', 'employer', 'organization_name']);
  const location = pickString(record, ['location', 'jobLocation', 'city', 'locationText', 'workplace', 'locations_derived']);
  const description = pickString(record, ['description', 'jobDescription', 'descriptionText', 'description_text', 'text', 'body', 'jobSummary']);
  const aiDescriptionEnriched = pickString(record, ['ai_description_enriched', 'aiSummary', 'enrichedDescription', 'ai_core_responsibilities']);
  const applyUrl = pickString(record, ['job_apply_url', 'applyUrl', 'applicationUrl', 'url', 'jobUrl', 'detailUrl', 'link']);
  const logoUrl = pickString(record, ['logo_url', 'companyLogo', 'logo', 'organization_logo']);
  const postedAt = pickString(record, ['postedAt', 'datePosted', 'datePostedAt', 'date_posted', 'createdAt', 'publishedAt', 'time']);
  const salary = pickString(record, ['salary', 'salaryText', 'rawSalary', 'aiSalary', 'compensation', 'salary_raw']);
  const salaryMin = pickNumber(record, ['salary_min', 'minSalary', 'salary_from', 'ai_salary_minvalue']);
  const salaryMax = pickNumber(record, ['salary_max', 'maxSalary', 'salary_to', 'ai_salary_maxvalue']);
  const atsDuplicate = !!record.ats_duplicate || !!record.isDuplicate;
  
  const requirements = pickStringArray(record, ['requirements', 'skills', 'aiSkills', 'aiRequirements', 'qualifications', 'ai_key_skills']);
  const workTypeHint = pickString(record, ['workArrangement', 'workType', 'aiWorkArrangement', 'ai_work_arrangement', 'employmentType', 'workplaceType']);

  if (!title || !company || !description || !applyUrl) {
    return null;
  }

  if (description.length < 30 || (!applyUrl.startsWith('http') && !applyUrl.startsWith('/'))) return null;

  return {
    jobId,
    title,
    company,
    location: location || 'Remote',
    description,
    aiDescriptionEnriched,
    applyUrl,
    logoUrl,
    postedAt: postedAt || new Date().toISOString(),
    salary,
    salaryMin,
    salaryMax,
    atsDuplicate,
    requirements,
    workTypeHint,
  };
}
