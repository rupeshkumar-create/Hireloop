import { PRO_DAILY_MATCH_LIMIT, isProPlan } from '../../lib/planLimits';
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

function genericLockedSlot(index: number): LockedMatchSlot {
  return {
    kind: 'locked',
    index,
    title: 'Premium Match',
    company: 'Hidden until you upgrade',
    location: 'Remote',
    salary: 'Top-fit role',
    teaser: 'Unlock 9 more AI-picked jobs daily',
  };
}

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

/** How many roles Scout ranked vs how many the plan reveals. */
export function getDailyBatchSummary(
  visibleJobs: Job[],
  plan?: string,
  hiddenJobs: Job[] = []
): DailyBatchSummary {
  const visibleCount = visibleJobs.length;
  if (isProPlan(plan) || visibleCount === 0) {
    return { visibleCount, hiddenCount: 0, totalScouted: visibleCount, teaserJobs: [] };
  }

  const fromServer = visibleCount + hiddenJobs.length;
  const totalScouted = fromServer > visibleCount
    ? fromServer
    : Math.max(visibleCount, PRO_DAILY_MATCH_LIMIT);
  const hiddenCount = Math.max(totalScouted - visibleCount, 0);

  return {
    visibleCount,
    hiddenCount,
    totalScouted,
    teaserJobs: hiddenJobs.slice(0, 3),
  };
}

export function buildMatchFeedItems(
  jobs: Job[],
  plan?: string,
  hiddenJobs: Job[] = [],
  options?: { compactPaywall?: boolean }
): MatchFeedItem[] {
  const realItems: MatchFeedItem[] = jobs.map((job, index) => ({
    kind: 'job',
    id: `job-${index}-${job.company}-${job.title}`,
    job,
  }));

  if (jobs.length === 0 || isProPlan(plan)) {
    return realItems;
  }

  if (options?.compactPaywall) {
    return realItems;
  }

  const lockedCount = Math.max(PRO_DAILY_MATCH_LIMIT - jobs.length, 0);
  const lockedItems: MatchFeedItem[] = [];

  for (let index = 0; index < lockedCount; index += 1) {
    const hiddenJob = hiddenJobs[index];
    lockedItems.push({
      kind: 'locked',
      id: `locked-${index}`,
      slot: hiddenJob ? buildLockedSlotFromJob(hiddenJob, index) : genericLockedSlot(index),
    });
  }

  return [...realItems, ...lockedItems];
}
