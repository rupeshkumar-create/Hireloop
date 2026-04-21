import type { Job } from '../types/dashboard';

function isValidHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export function resolveJobApplicationUrl(job: Job | null | undefined): string | null {
  if (!job) return null;

  const candidates: unknown[] = [
    (job as any).applyUrl,
    (job as any).url,
    (job as any).applicationUrl,
    (job as any).jobUrl,
  ];

  for (const candidate of candidates) {
    if (isValidHttpUrl(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}

/** Returns the direct apply URL if available, or a Google search for the job as fallback. */
export function resolveJobApplicationUrlWithFallback(job: Job | null | undefined): string {
  if (!job) return '#';
  const direct = resolveJobApplicationUrl(job);
  if (direct) return direct;
  const query = encodeURIComponent(`${job.title} ${job.company} job apply`);
  return `https://www.google.com/search?q=${query}`;
}

/** Returns true when the resolved URL is a fallback search (no direct apply link). */
export function isJobUrlFallback(job: Job | null | undefined): boolean {
  return resolveJobApplicationUrl(job) === null;
}
