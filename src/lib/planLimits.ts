export const FREE_DAILY_MATCH_LIMIT = 1;
export const PRO_DAILY_MATCH_LIMIT = 10;

function normalizePlan(plan?: string): string {
  return (plan || '').trim().toLowerCase();
}

export function isProPlan(plan?: string): boolean {
  return normalizePlan(plan) === 'pro';
}

export function getDailyMatchLimit(plan?: string): number {
  return isProPlan(plan) ? PRO_DAILY_MATCH_LIMIT : FREE_DAILY_MATCH_LIMIT;
}
