import { describe, expect, it } from 'vitest';
import { evaluateScoutDedup } from '../scoutDedup';

describe('evaluateScoutDedup', () => {
  it('blocks when today batch already meets the free plan cap', () => {
    const result = evaluateScoutDedup(
      {
        plan: 'free',
        deliveryTimezone: 'UTC',
        dailyJobs: [{ title: 'Engineer' }],
        dailyJobsMeta: { deliveryLocalDate: '2026-06-06' },
        lastJobFetchTime: '2026-06-06T10:00:00.000Z',
      },
      new Date('2026-06-06T15:00:00.000Z')
    );

    expect(result.blocked).toBe(true);
    expect(result.existingCount).toBe(1);
    expect(result.planCap).toBe(1);
  });

  it('allows pro users with fewer jobs than the cap to regenerate', () => {
    const result = evaluateScoutDedup(
      {
        plan: 'pro',
        deliveryTimezone: 'UTC',
        dailyJobs: [{ title: 'Engineer' }],
        dailyJobsMeta: { deliveryLocalDate: '2026-06-06' },
        lastJobFetchTime: '2026-06-06T10:00:00.000Z',
      },
      new Date('2026-06-06T15:00:00.000Z')
    );

    expect(result.blocked).toBe(false);
    expect(result.planCap).toBe(10);
  });

  it('allows a new run on a new local day', () => {
    const result = evaluateScoutDedup(
      {
        plan: 'free',
        deliveryTimezone: 'UTC',
        dailyJobs: [{ title: 'Engineer' }],
        dailyJobsMeta: { deliveryLocalDate: '2026-06-05' },
        lastJobFetchTime: '2026-06-05T10:00:00.000Z',
      },
      new Date('2026-06-06T15:00:00.000Z')
    );

    expect(result.blocked).toBe(false);
  });
});
