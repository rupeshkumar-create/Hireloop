import { PRO_DAILY_MATCH_LIMIT, isProPlan } from '../../lib/planLimits';
import type { Job } from '../../types/dashboard';

export interface LockedMatchSlot {
  kind: 'locked';
  index: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  teaser: string;
}

export type MatchFeedItem =
  | { kind: 'job'; id: string; job: Job }
  | { kind: 'locked'; id: string; slot: LockedMatchSlot };

export function buildMatchFeedItems(jobs: Job[], plan?: string): MatchFeedItem[] {
  const realItems: MatchFeedItem[] = jobs.map((job, index) => ({
    kind: 'job',
    id: `job-${index}-${job.company}-${job.title}`,
    job,
  }));

  if (jobs.length === 0 || isProPlan(plan)) {
    return realItems;
  }

  const lockedCount = Math.max(PRO_DAILY_MATCH_LIMIT - jobs.length, 0);

  const lockedItems: MatchFeedItem[] = Array.from(
    { length: lockedCount },
    (_, index) => ({
      kind: 'locked',
      id: `locked-${index}`,
      slot: {
        kind: 'locked',
        index,
        title: 'Premium Match',
        company: 'Hidden until you upgrade',
        location: 'Remote',
        salary: 'Top-fit role',
        teaser: 'Unlock 9 more AI-picked jobs daily',
      },
    })
  );

  return [...realItems, ...lockedItems];
}
