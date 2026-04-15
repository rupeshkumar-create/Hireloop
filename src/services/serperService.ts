

export interface SerperJob {
  title: string;
  company: string;
  location: string;
  description: string;
  applyLink: string;
  salary: string;
  postedAt: string;
  daysOld?: number;
}

export interface SearchRemoteJobsOptions {
  allowedDomains?: string[];
  blockedDomains?: string[];
  skipNetworkFetchForDomains?: string[];
  allowCompanyCareerPages?: boolean;
  maxQueries?: number;
  maxDaysOld?: number;
}

export interface SearchRemoteJobsStats {
  queriesRun: number;
  jobsSeen: number;
  removedByDuplicate: number;
  removedByRemoteFilter: number;
  removedByFreshnessFilter: number;
  removedByMissingLink: number;
  removedByLinkValidation: number;
  removedByShapeValidation: number;
}

export interface SearchRemoteJobsResult {
  jobs: SerperJob[];
  stats: SearchRemoteJobsStats;
}

export interface JobLinkValidationResult {
  valid: boolean;
  finalUrl: string;
}

/**
 * Parses Serper's "X days ago" / "X weeks ago" strings into a number of days.
 * Returns 0 for "today", "just posted", "X hours ago".
 * Returns 999 if completely unparseable (will be filtered out as stale).
 */
function parsePostedDaysAgo(postedAt: string): number {
  const s = (postedAt || '').toLowerCase().trim();
  if (!s) return 0; // unknown date → treat as fresh, let it through

  if (
    s.includes('just') ||
    s.includes('today') ||
    s.includes('hour') ||
    s.includes('minute') ||
    s.includes('second')
  ) {
    return 0;
  }

  const daysMatch = s.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1], 10);

  const weeksMatch = s.match(/(\d+)\s*week/);
  if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;

  const monthsMatch = s.match(/(\d+)\s*month/);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;

  return 0; // unparseable → let it through rather than silently dropping it
}

const VALID_ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'ashbyhq.com',
  'workday.com',
];

const BLOCKED_JOB_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'google.com',
];

export async function validateJobLink(
  url: string,
  allowedDomains: string[] = VALID_ATS_DOMAINS,
  allowCompanyCareerPages: boolean = false,
  options: { blockedDomains?: string[]; skipNetworkFetchForDomains?: string[] } = {}
): Promise<JobLinkValidationResult> {
  try {
    const response = await fetch('/api/validate-job-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        allowedDomains,
        blockedDomains: options.blockedDomains ?? BLOCKED_JOB_DOMAINS,
        skipNetworkFetchForDomains: options.skipNetworkFetchForDomains ?? [],
        allowCompanyCareerPages,
      }),
    });

    if (!response.ok) {
      return {
        valid: false,
        finalUrl: url,
      };
    }

    const data = await response.json();
    return {
      valid: data.valid === true,
      finalUrl: typeof data.finalUrl === 'string' ? data.finalUrl : url,
    };
  } catch {
    return {
      valid: false,
      finalUrl: url,
    };
  }
}

function looksLikeCareerPage(url: string): boolean {
  return /careers|jobs|job-application|job\/|apply/.test(url.toLowerCase());
}

function scoreApplyLink(
  url: string,
  allowedDomains: string[],
  allowCompanyCareerPages: boolean,
  blockedDomains: string[]
): number {
  const normalized = url.toLowerCase();
  if (!normalized.startsWith('http')) return -100;
  if (normalized.includes('google.com/search')) return -100;
  if (VALID_ATS_DOMAINS.some((domain) => normalized.includes(domain))) return 300;
  const isBlocked = blockedDomains.some((domain) => normalized.includes(domain.toLowerCase()));
  if (allowCompanyCareerPages && !isBlocked && looksLikeCareerPage(normalized)) return 200;
  if (!isBlocked && allowedDomains.some((domain) => normalized.includes(domain.toLowerCase()))) return 120;
  return 0;
}

function collectCandidateLinks(job: any): string[] {
  const collected: string[] = [];
  const pushLink = (value: any) => {
    if (typeof value === 'string' && value.trim().length > 0) collected.push(value.trim());
  };

  if (Array.isArray(job.apply_options)) {
    for (const option of job.apply_options) {
      pushLink(option?.link);
    }
  }
  pushLink(job.apply_link);
  pushLink(job.link);

  return Array.from(new Set(collected));
}

function pickBestApplyLink(
  job: any,
  allowedDomains: string[],
  allowCompanyCareerPages: boolean,
  blockedDomains: string[]
): string {
  const candidates = collectCandidateLinks(job)
    .filter((link) => !link.includes('google.com/search'))
    .sort(
      (a, b) =>
        scoreApplyLink(b, allowedDomains, allowCompanyCareerPages, blockedDomains) -
        scoreApplyLink(a, allowedDomains, allowCompanyCareerPages, blockedDomains)
    );
  return candidates[0] || '';
}

function isValidJob(job: SerperJob): boolean {
  const normalizedTitle = job.title.trim().toLowerCase();
  return (
    job.title.trim().length > 3 &&
    job.company.trim().length > 2 &&
    job.applyLink.startsWith('http') &&
    job.location.toLowerCase().includes('remote') &&
    job.description.trim().length > 0 &&
    normalizedTitle !== 'job' &&
    normalizedTitle !== 'opening'
  );
}

/** Stable fingerprint for deduplication: lowercase title + company */
export function jobFingerprint(title: string, company: string): string {
  return `${title.toLowerCase().trim()}::${company.toLowerCase().trim()}`;
}

/**
 * Searches Google Jobs via Serper API for real remote job listings.
 * - Searches all career paths (up to 3) to maximise fresh results.
 * - Filters: remote-only, posted within last 7 days.
 * - Deduplicates within the response by title+company fingerprint.
 */
export async function searchRemoteJobs(
  queries: string[],
  options: SearchRemoteJobsOptions = {}
): Promise<SearchRemoteJobsResult> {
  const stats: SearchRemoteJobsStats = {
    queriesRun: 0,
    jobsSeen: 0,
    removedByDuplicate: 0,
    removedByRemoteFilter: 0,
    removedByFreshnessFilter: 0,
    removedByMissingLink: 0,
    removedByLinkValidation: 0,
    removedByShapeValidation: 0,
  };
  const allJobs: SerperJob[] = [];
  const seen = new Set<string>();
  const allowedDomains = options.allowedDomains || VALID_ATS_DOMAINS;
  const allowCompanyCareerPages = options.allowCompanyCareerPages === true;
  const blockedDomains = options.blockedDomains || BLOCKED_JOB_DOMAINS;
  const skipNetworkFetchForDomains = options.skipNetworkFetchForDomains || [];
  const maxDaysOld = options.maxDaysOld ?? 7;

  // Ensure we don't spam the API if the array is huge
  const queriesToSearch = queries.slice(0, options.maxQueries ?? 3);

  for (const query of queriesToSearch) {
    try {
      stats.queriesRun += 1;
      const response = await fetch('/api/serper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 30 }),
      });

      if (!response.ok) {
        console.error(`Serper responded with ${response.status} for query: "${query}"`);
        continue;
      }

      const data = await response.json();
      const jobs: any[] = data.jobs || [];

      for (const job of jobs) {
        stats.jobsSeen += 1;
        // ── 1. Deduplicate within this batch ──────────────────────────────
        const fp = jobFingerprint(job.title || '', job.company_name || '');
        if (seen.has(fp)) {
          stats.removedByDuplicate += 1;
          continue;
        }
        seen.add(fp);

        // ── 2. Remote-only filter ─────────────────────────────────────────
        const loc: string = job.location || '';
        const scheduleType: string = job.detected_extensions?.schedule_type || '';
        const isRemote =
          loc.toLowerCase().includes('remote') ||
          scheduleType.toLowerCase().includes('remote') ||
          job.detected_extensions?.work_from_home === true;
        if (!isRemote) {
          stats.removedByRemoteFilter += 1;
          continue;
        }

        // ── 3. Staleness filter ───────────────────────────────────────────
        const postedAt: string = job.detected_extensions?.posted_at || '';
        const daysOld = parsePostedDaysAgo(postedAt);
        if (daysOld > maxDaysOld) {
          stats.removedByFreshnessFilter += 1;
          continue;
        }

        const finalLink = pickBestApplyLink(job, allowedDomains, allowCompanyCareerPages, blockedDomains);

        // Ensure there is a valid direct link
        if (!finalLink || finalLink.includes('google.com/search')) {
          stats.removedByMissingLink += 1;
          continue;
        }

        const linkValidation = await validateJobLink(finalLink, allowedDomains, allowCompanyCareerPages, {
          blockedDomains,
          skipNetworkFetchForDomains,
        });
        if (!linkValidation.valid) {
          stats.removedByLinkValidation += 1;
          continue;
        }

        const safeLocation = (loc || '').trim();
        const normalizedLocation = safeLocation.length > 0 ? safeLocation : 'Remote';
        const finalLocation = normalizedLocation.toLowerCase().includes('remote')
          ? normalizedLocation
          : `Remote (${normalizedLocation})`;

        const candidateJob: SerperJob = {
          title: job.title || '',
          company: job.company_name || '',
          location: finalLocation,
          description: job.description || '',
          applyLink: linkValidation.finalUrl || finalLink,
          salary: job.detected_extensions?.salary || '',
          postedAt,
          daysOld,
        };

        if (!isValidJob(candidateJob)) {
          stats.removedByShapeValidation += 1;
          continue;
        }
        allJobs.push(candidateJob);
      }
    } catch (err) {
      console.error(`Serper search failed for "${query}":`, err);
    }
  }

  return {
    jobs: allJobs,
    stats,
  };
}
