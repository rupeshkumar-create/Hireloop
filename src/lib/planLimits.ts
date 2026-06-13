/** Daily job matches delivered to every user (Free and Pro). Apify cost is the same per run. */
export const DAILY_MATCH_LIMIT = 10;

/** @deprecated Use DAILY_MATCH_LIMIT — kept for imports that reference legacy names. */
export const FREE_DAILY_MATCH_LIMIT = DAILY_MATCH_LIMIT;
/** @deprecated Use DAILY_MATCH_LIMIT — kept for imports that reference legacy names. */
export const PRO_DAILY_MATCH_LIMIT = DAILY_MATCH_LIMIT;

/** Pool size fetched from ATS + Apify before matching (same for all plans). */
export const DISCOVERY_POOL_TARGET = 100;

function normalizePlan(plan?: string): string {
  return (plan || '').trim().toLowerCase();
}

export function isProPlan(plan?: string): boolean {
  return normalizePlan(plan) === 'pro';
}

export function getDailyMatchLimit(_plan?: string): number {
  return DAILY_MATCH_LIMIT;
}

export function getDiscoveryPoolTarget(_plan?: string): number {
  return DISCOVERY_POOL_TARGET;
}
