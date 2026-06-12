import { getDailyMatchLimit } from '../lib/planLimits.js';
import { formatLocalDate, resolveLocalDateForLastFetch } from '../lib/localDate.js';

export interface ScoutDedupResult {
  blocked: boolean;
  existingCount: number;
  planCap: number;
  runDate: string;
}

/** Block redundant user-triggered Scout runs when today's batch already meets the plan cap. */
export function evaluateScoutDedup(
  profile: Record<string, unknown>,
  now: Date = new Date()
): ScoutDedupResult {
  const deliveryTimezone =
    typeof profile.deliveryTimezone === 'string' ? profile.deliveryTimezone : 'UTC';
  const runDate = formatLocalDate(now, deliveryTimezone);
  const planCap = getDailyMatchLimit(
    typeof profile.plan === 'string' ? profile.plan : undefined
  );

  const allowUnlimited = String(process.env.ALLOW_UNLIMITED_SCOUT_REGEN || '').toLowerCase() === 'true';
  if (allowUnlimited) {
    return { blocked: false, existingCount: 0, planCap, runDate };
  }

  const fetchDate = resolveLocalDateForLastFetch(profile, now);
  const dailyJobs = Array.isArray(profile.dailyJobs) ? profile.dailyJobs : [];
  const existingCount = dailyJobs.length;

  if (fetchDate === runDate && existingCount > 0 && existingCount >= planCap) {
    return { blocked: true, existingCount, planCap, runDate };
  }

  return { blocked: false, existingCount, planCap, runDate };
}
