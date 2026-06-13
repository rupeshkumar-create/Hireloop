import { isProPlan } from '../../lib/planLimits';
import type { Job } from '../../types/dashboard';

export interface LockedMatchSlot {
  kind: 'locked';
  index: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  matchScore?: number;
  teaser: string;
}

export type MatchFeedItem =
  | { kind: 'job'; id: string; job: Job }
  | { kind: 'locked'; id: string; slot: LockedMatchSlot };

export function buildLockedSlotFromJob(job: Job, index: number): LockedMatchSlot {
  const score = job.matchScore ?? job.finalScore;
  const scoreHint = score ? `${score}/100 fit` : 'High-fit role';

  return {
    kind: 'locked',
    index,
    title: job.title || 'Senior role match',
    company: job.company || 'Top company',
    location: job.location || 'Remote',
    salary: job.salary || 'Competitive',
    matchScore: score,
    teaser: `${scoreHint} · Pro only`,
  };
}

export interface DailyBatchSummary {
  visibleCount: number;
  hiddenCount: number;
  totalScouted: number;
  teaserJobs: Job[];
}

/** Free and Pro users see the same number of daily matches — no hidden job paywall. */
export function getDailyBatchSummary(
  visibleJobs: Job[],
  _plan?: string,
  _hiddenJobs: Job[] = []
): DailyBatchSummary {
  const visibleCount = visibleJobs.length;
  return { visibleCount, hiddenCount: 0, totalScouted: visibleCount, teaserJobs: [] };
}

export function buildMatchFeedItems(
  jobs: Job[],
  _plan?: string,
  _hiddenJobs: Job[] = [],
  _options?: { compactPaywall?: boolean }
): MatchFeedItem[] {
  return jobs.map((job, index) => ({
    kind: 'job',
    id: `job-${index}-${job.company}-${job.title}`,
    job,
  }));
}

/** @deprecated Job-match paywall removed — free users receive full daily batches. */
export function isFreePlanWithJobPaywall(plan?: string): boolean {
  return !isProPlan(plan);
}
