

export interface SerperJob {
  title: string;
  company: string;
  location: string;
  description: string;
  applyLink: string;
  salary: string;
  postedAt: string;
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
  queries: string[]
): Promise<SerperJob[]> {
  const allJobs: SerperJob[] = [];
  const seen = new Set<string>();

  // Ensure we don't spam the API if the array is huge
  const queriesToSearch = queries.slice(0, 3);

  for (const query of queriesToSearch) {
    try {
      const response = await fetch('/api/serper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 10 }),
      });

      if (!response.ok) {
        console.error(`Serper responded with ${response.status} for query: "${query}"`);
        continue;
      }

      const data = await response.json();
      const jobs: any[] = data.jobs || [];

      for (const job of jobs) {
        // ── 1. Deduplicate within this batch ──────────────────────────────
        const fp = jobFingerprint(job.title || '', job.company_name || '');
        if (seen.has(fp)) continue;
        seen.add(fp);

        // ── 2. Remote-only filter ─────────────────────────────────────────
        const loc: string = job.location || '';
        const scheduleType: string = job.detected_extensions?.schedule_type || '';
        const isRemote =
          loc.toLowerCase().includes('remote') ||
          scheduleType.toLowerCase().includes('remote') ||
          job.detected_extensions?.work_from_home === true;
        if (!isRemote) continue;

        // ── 3. 7-day staleness filter ─────────────────────────────────────
        const postedAt: string = job.detected_extensions?.posted_at || '';
        const daysOld = parsePostedDaysAgo(postedAt);
        if (daysOld > 7) continue;

        allJobs.push({
          title: job.title || '',
          company: job.company_name || '',
          location: loc || 'Remote',
          description: job.description || '',
          applyLink:
            job.apply_link ||
            `https://www.google.com/search?q=${encodeURIComponent(
              `${job.title} ${job.company_name} remote job apply`
            )}`,
          salary: job.detected_extensions?.salary || '',
          postedAt,
        });
      }
    } catch (err) {
      console.error(`Serper search failed for "${query}":`, err);
    }
  }

  return allJobs;
}
