import { describe, expect, it } from 'vitest';
import {
  FREE_DAILY_MATCH_LIMIT,
  PRO_DAILY_MATCH_LIMIT,
  getDailyMatchLimit,
  isProPlan,
} from '../planLimits';

describe('getDailyMatchLimit', () => {
  it('returns the free limit when the plan is missing', () => {
    expect(getDailyMatchLimit()).toBe(FREE_DAILY_MATCH_LIMIT);
  });

  it('normalizes the plan string before checking pro access', () => {
    expect(getDailyMatchLimit('Pro')).toBe(PRO_DAILY_MATCH_LIMIT);
    expect(getDailyMatchLimit(' pro ')).toBe(PRO_DAILY_MATCH_LIMIT);
  });

  it('falls back to the free limit for unknown plans', () => {
    expect(getDailyMatchLimit('enterprise')).toBe(FREE_DAILY_MATCH_LIMIT);
  });
});

describe('isProPlan', () => {
  it('returns true only for normalized pro plans', () => {
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('Pro')).toBe(true);
    expect(isProPlan('free')).toBe(false);
    expect(isProPlan(undefined)).toBe(false);
  });
});
