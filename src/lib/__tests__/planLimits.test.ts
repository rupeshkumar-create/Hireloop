import { describe, expect, it } from 'vitest';
import {
  FREE_DAILY_MATCH_LIMIT,
  PRO_DAILY_MATCH_LIMIT,
  DAILY_MATCH_LIMIT,
  getDailyMatchLimit,
  isProPlan,
} from '../planLimits';

describe('getDailyMatchLimit', () => {
  it('returns 10 matches for all users regardless of plan', () => {
    expect(getDailyMatchLimit()).toBe(DAILY_MATCH_LIMIT);
    expect(getDailyMatchLimit('free')).toBe(DAILY_MATCH_LIMIT);
    expect(getDailyMatchLimit('Pro')).toBe(DAILY_MATCH_LIMIT);
    expect(getDailyMatchLimit(' pro ')).toBe(DAILY_MATCH_LIMIT);
    expect(getDailyMatchLimit('enterprise')).toBe(DAILY_MATCH_LIMIT);
  });

  it('legacy constants match the unified daily limit', () => {
    expect(FREE_DAILY_MATCH_LIMIT).toBe(DAILY_MATCH_LIMIT);
    expect(PRO_DAILY_MATCH_LIMIT).toBe(DAILY_MATCH_LIMIT);
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
