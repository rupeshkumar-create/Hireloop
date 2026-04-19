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
