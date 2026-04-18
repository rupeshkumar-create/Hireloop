/**
 * jobHarvester.ts
 *
 * Multi-source job harvesting with deduplication.
 * Sources (all return full job descriptions – no external redirects required):
 *   PRIMARY  : Remotive  (free, no key)
 *   SECONDARY: Arbeitnow (free, no key)
 *   TERTIARY : Jobicy    (free, no key)
 *   BACKUP   : JSearch via RapidAPI (optional, requires RAPIDAPI_KEY)
 *
 * All sources are queried in parallel. Results are normalized to RawJob then
 * deduped by fingerprint (title::company) before being returned.
 */

export type JobWorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobSource = 'remotive' | 'arbeitnow' | 'jsearch' | 'jobicy';

export interface RawJob {
  // ── Identity
  fingerprint: string;          // title::company (stable dedup key)

  // ── Listing
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  workType: JobWorkType;

  // ── Compensation
  salary: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;

  // ── Full content (stored, shown inline)
  description: string;         // plain text (HTML stripped)
  tags?: string[];             // keywords / tech tags from the source

  // ── Provenance
  source: JobSource;
  applyUrl: string;
  postedAt: string;            // ISO string
  daysOld: number;
}

export interface HarvestOptions {
  jobType?: string;            // 'remote' | 'hybrid' | 'onsite' | 'both'
  location?: string;
  maxPerSource?: number;       // cap per source (default 30)
  maxTotal?: number;           // hard cap across all sources (default 80)
}

export interface HarvestStats {
  totalFetched: number;
  deduplicated: number;
  bySource: Record<JobSource, number>;
}

export interface HarvestResult {
  jobs: RawJob[];
  stats: HarvestStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFingerprint(title: string, company: string): string {
  return `${title.toLowerCase().trim()}::${company.toLowerCase().trim()}`;
}

export function jobFingerprint(title: string, company: string): string {
  return makeFingerprint(title, company);
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function daysOldFromDate(dateStr: string): number {
  if (!dateStr) return 0;
  const posted = new Date(dateStr);
  if (isNaN(posted.getTime())) return 0;
  return Math.floor((Date.now() - posted.getTime()) / 86_400_000);
}

function detectWorkType(location: string, description: string, meta?: string): JobWorkType {
  const text = `${location} ${description} ${meta || ''}`.toLowerCase();
  if (text.includes('remote')) return 'remote';
  if (text.includes('hybrid')) return 'hybrid';
  if (text.includes('onsite') || text.includes('on-site') || text.includes('in-office')) return 'onsite';
  return 'unknown';
}

function parseSalaryString(raw: string): { min?: number; max?: number; currency?: string } {
  if (!raw) return {};
  const nums = raw.replace(/,/g, '').match(/\d{4,}/g);
  if (!nums) return {};
  const currency = raw.match(/[€£¥]|\bUSD\b|\bEUR\b|\bGBP\b/i)?.[0] || 'USD';
  if (nums.length >= 2) return { min: +nums[0], max: +nums[1], currency };
  if (nums.length === 1) return { min: +nums[0], currency };
  return {};
}

function formatSalary(min?: number, max?: number, currency = 'USD', period = 'yearly'): string {
  if (!min && !max) return '';
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;
  const range = max && max !== min ? `${sym}${fmt(min!)} – ${sym}${fmt(max)}` : `${sym}${fmt(min!)}`;
  const suffix = period === 'hourly' ? '/hr' : period === 'monthly' ? '/mo' : '/yr';
  return `${range} ${suffix}`;
}

function wantsRemote(jobType?: string): boolean {
  return !jobType || jobType === 'remote' || jobType === 'both';
}

function wantsOnsite(jobType?: string): boolean {
  return jobType === 'onsite' || jobType === 'hybrid' || jobType === 'both';
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: Remotive (https://remotive.com/api)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRemotive(
  searchTerms: string[],
  maxJobs: number
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const term of searchTerms.slice(0, 3)) {
    if (jobs.length >= maxJobs) break;
    try {
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=30`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;

      const data = await res.json();
      const list: any[] = data.jobs || [];

      for (const j of list) {
        if (jobs.length >= maxJobs) break;
        const fp = makeFingerprint(j.title || '', j.company_name || '');
        if (seen.has(fp)) continue;
        seen.add(fp);

        const desc = stripHtml(j.description || '');
        if (!desc || desc.length < 50) continue;

        const salary = j.salary || '';
        const { min, max, currency } = parseSalaryString(salary);

        jobs.push({
          fingerprint: fp,
          title: j.title || '',
          company: j.company_name || '',
          companyLogo: j.company_logo || undefined,
          location: j.candidate_required_location || 'Worldwide',
          workType: 'remote',
          salary: salary || formatSalary(min, max, currency),
          salaryMin: min,
          salaryMax: max,
          salaryCurrency: currency,
          description: desc,
          tags: Array.isArray(j.tags) ? j.tags : [],
          source: 'remotive',
          applyUrl: j.url || '',
          postedAt: j.publication_date ? new Date(j.publication_date).toISOString() : new Date().toISOString(),
          daysOld: daysOldFromDate(j.publication_date),
        });
      }
    } catch {
      // silently skip failed sources
    }
  }

  return jobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: Arbeitnow (https://www.arbeitnow.com/api)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchArbeitnow(
  searchTerms: string[],
  options: HarvestOptions,
  maxJobs: number
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const remoteOnly = options.jobType === 'remote';

  for (const term of searchTerms.slice(0, 3)) {
    if (jobs.length >= maxJobs) break;
    try {
      const params = new URLSearchParams({ search: term });
      if (remoteOnly) params.set('remote', 'true');
      const url = `https://www.arbeitnow.com/api/job-board-api?${params}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;

      const data = await res.json();
      const list: any[] = data.data || [];

      for (const j of list) {
        if (jobs.length >= maxJobs) break;
        const fp = makeFingerprint(j.title || '', j.company_name || '');
        if (seen.has(fp)) continue;
        seen.add(fp);

        const desc = stripHtml(j.description || '');
        if (!desc || desc.length < 50) continue;

        const workType = j.remote ? 'remote' : detectWorkType(j.location || '', desc);
        if (remoteOnly && workType !== 'remote') continue;

        const salary = j.salary || '';
        const { min, max, currency } = parseSalaryString(salary);

        jobs.push({
          fingerprint: fp,
          title: j.title || '',
          company: j.company_name || '',
          location: j.location || (j.remote ? 'Remote' : 'Not specified'),
          workType,
          salary: salary || formatSalary(min, max, currency),
          salaryMin: min,
          salaryMax: max,
          salaryCurrency: currency,
          description: desc,
          tags: Array.isArray(j.tags) ? j.tags : [],
          source: 'arbeitnow',
          applyUrl: j.url || '',
          postedAt: j.published_at ? new Date(j.published_at * 1000).toISOString() : new Date().toISOString(),
          daysOld: j.published_at ? daysOldFromDate(new Date(j.published_at * 1000).toISOString()) : 0,
        });
      }
    } catch {
      // silently skip
    }
  }

  return jobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: Jobicy (https://jobicy.com/api/v2)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJobicy(
  searchTerms: string[],
  maxJobs: number
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const term of searchTerms.slice(0, 2)) {
    if (jobs.length >= maxJobs) break;
    try {
      const safeTag = term.replace(/\s+/g, '-').toLowerCase();
      const url = `https://jobicy.com/api/v2/remote-jobs?count=30&tag=${encodeURIComponent(safeTag)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Hireschema/2.0' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.success || !Array.isArray(data.jobs)) continue;

      for (const j of data.jobs) {
        if (jobs.length >= maxJobs) break;
        const fp = makeFingerprint(j.jobTitle || '', j.companyName || '');
        if (seen.has(fp)) continue;
        seen.add(fp);

        const desc = stripHtml(j.jobDescription || '');
        if (!desc || desc.length < 50) continue;

        const salary = j.salaryMin
          ? formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod)
          : '';

        jobs.push({
          fingerprint: fp,
          title: j.jobTitle || '',
          company: j.companyName || '',
          companyLogo: j.companyLogo || undefined,
          location: j.jobGeo || 'Worldwide',
          workType: 'remote',
          salary,
          salaryMin: j.salaryMin ? Number(j.salaryMin) : undefined,
          salaryMax: j.salaryMax ? Number(j.salaryMax) : undefined,
          salaryCurrency: j.salaryCurrency || 'USD',
          description: desc,
          tags: Array.isArray(j.jobIndustry) ? j.jobIndustry : [],
          source: 'jobicy',
          applyUrl: j.url || '',
          postedAt: j.pubDate ? new Date(j.pubDate).toISOString() : new Date().toISOString(),
          daysOld: daysOldFromDate(j.pubDate),
        });
      }
    } catch {
      // silently skip
    }
  }

  return jobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: JSearch via RapidAPI (optional – only if RAPIDAPI_KEY env var is set)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJSearch(
  searchTerms: string[],
  options: HarvestOptions,
  maxJobs: number,
  rapidApiKey: string
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const remoteOnly = options.jobType === 'remote';

  for (const term of searchTerms.slice(0, 3)) {
    if (jobs.length >= maxJobs) break;
    try {
      const query = remoteOnly ? `${term} remote` : term;
      const params = new URLSearchParams({
        query,
        num_pages: '2',
        date_posted: 'week',
      });
      if (options.location && !remoteOnly) params.set('country', options.location.split(',')[0].trim());

      const url = `https://jsearch.p.rapidapi.com/search?${params}`;
      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const list: any[] = data.data || [];

      for (const j of list) {
        if (jobs.length >= maxJobs) break;
        const fp = makeFingerprint(j.job_title || '', j.employer_name || '');
        if (seen.has(fp)) continue;
        seen.add(fp);

        const desc = j.job_description || '';
        if (!desc || desc.length < 50) continue;

        const workType: JobWorkType = j.job_is_remote ? 'remote' : detectWorkType(
          `${j.job_city || ''} ${j.job_country || ''}`,
          desc,
          j.job_employment_type
        );
        if (remoteOnly && workType !== 'remote') continue;

        const salaryStr = j.job_salary_min || j.job_salary_max
          ? formatSalary(j.job_salary_min, j.job_salary_max, j.job_salary_currency, 'yearly')
          : '';

        jobs.push({
          fingerprint: fp,
          title: j.job_title || '',
          company: j.employer_name || '',
          companyLogo: j.employer_logo || undefined,
          location: j.job_is_remote
            ? 'Remote'
            : [j.job_city, j.job_country].filter(Boolean).join(', ') || 'Not specified',
          workType,
          salary: salaryStr,
          salaryMin: j.job_salary_min ? Number(j.job_salary_min) : undefined,
          salaryMax: j.job_salary_max ? Number(j.job_salary_max) : undefined,
          salaryCurrency: j.job_salary_currency || 'USD',
          description: desc,
          tags: Array.isArray(j.job_required_skills) ? j.job_required_skills : [],
          source: 'jsearch',
          applyUrl: j.job_apply_link || '',
          postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
          daysOld: daysOldFromDate(j.job_posted_at_datetime_utc),
        });
      }
    } catch {
      // silently skip
    }
  }

  return jobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: buildSearchTerms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a deduplicated list of search terms from career paths and skills.
 * The top 5 terms are used to query each job source.
 */
export function buildSearchTerms(
  careerPaths: string[],
  resumeSkills: string[] = []
): string[] {
  const terms = new Set<string>();
  for (const path of careerPaths.slice(0, 5)) {
    terms.add(path.trim());
  }
  // Augment with skill-qualified variants of the top career path
  const primaryPath = careerPaths[0] || 'software engineer';
  for (const skill of resumeSkills.slice(0, 3)) {
    terms.add(`${primaryPath} ${skill}`);
  }
  return Array.from(terms).slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: harvestJobs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queries all configured job sources in parallel, deduplicates, and returns
 * up to options.maxTotal (default 80) raw jobs ready for AI ranking.
 *
 * Called from the server-side cron only – never from the browser.
 */
export async function harvestJobs(
  searchTerms: string[],
  options: HarvestOptions = {},
  rapidApiKey?: string
): Promise<HarvestResult> {
  const maxPerSource = options.maxPerSource ?? 30;
  const maxTotal = options.maxTotal ?? 80;
  const wRemote = wantsRemote(options.jobType);
  const wOther = wantsOnsite(options.jobType);

  const stats: HarvestStats = {
    totalFetched: 0,
    deduplicated: 0,
    bySource: { remotive: 0, arbeitnow: 0, jsearch: 0, jobicy: 0 },
  };

  // Run all sources in parallel
  const fetches: Promise<RawJob[]>[] = [];

  if (wRemote) {
    fetches.push(fetchRemotive(searchTerms, maxPerSource));
    fetches.push(fetchJobicy(searchTerms, maxPerSource));
  }

  if (wRemote || wOther) {
    fetches.push(fetchArbeitnow(searchTerms, options, maxPerSource));
  }

  if (rapidApiKey) {
    fetches.push(fetchJSearch(searchTerms, options, maxPerSource, rapidApiKey));
  }

  const settled = await Promise.allSettled(fetches);
  const allRaw: RawJob[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') allRaw.push(...result.value);
  }

  stats.totalFetched = allRaw.length;
  for (const job of allRaw) stats.bySource[job.source]++;

  // Global deduplication by fingerprint
  const seen = new Set<string>();
  const deduped: RawJob[] = [];
  for (const job of allRaw) {
    if (seen.has(job.fingerprint)) continue;
    seen.add(job.fingerprint);
    deduped.push(job);
    if (deduped.length >= maxTotal) break;
  }

  stats.deduplicated = stats.totalFetched - deduped.length;

  return { jobs: deduped, stats };
}
