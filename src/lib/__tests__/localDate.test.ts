import { describe, expect, it } from 'vitest';
import {
  formatLocalDate,
  formatLocalDateFromIso,
  resolveDeliveryTimeZone,
  resolveTodayLocalDateKey,
  resolveLocalDateForLastFetch,
} from '../localDate';

describe('localDate', () => {
  it('formats a date as YYYY-MM-DD for a given time zone', () => {
    const now = new Date('2026-04-29T20:00:00.000Z');

    expect(formatLocalDate(now, 'Asia/Kolkata')).toBe('2026-04-30');
    expect(formatLocalDate(now, 'America/Los_Angeles')).toBe('2026-04-29');
  });

  it('formats an ISO timestamp as YYYY-MM-DD for a given time zone', () => {
    const iso = '2026-04-29T20:00:00.000Z';

    expect(formatLocalDateFromIso(iso, 'Asia/Kolkata')).toBe('2026-04-30');
    expect(formatLocalDateFromIso(iso, 'America/Los_Angeles')).toBe('2026-04-29');
  });

  it('resolves delivery timezone from profile metadata', () => {
    expect(resolveDeliveryTimeZone({})).toBe('UTC');
    expect(resolveDeliveryTimeZone({ deliveryTimezone: 'America/Los_Angeles' })).toBe('America/Los_Angeles');
    expect(
      resolveDeliveryTimeZone({
        deliveryTimezone: 'America/Los_Angeles',
        dailyJobsMeta: { deliveryTimezone: 'Asia/Kolkata' },
      })
    ).toBe('Asia/Kolkata');
  });

  it('computes today local date key from profile delivery timezone', () => {
    const now = new Date('2026-04-29T20:00:00.000Z');
    expect(resolveTodayLocalDateKey(now, { deliveryTimezone: 'Asia/Kolkata' })).toBe('2026-04-30');
    expect(resolveTodayLocalDateKey(now, { deliveryTimezone: 'America/Los_Angeles' })).toBe('2026-04-29');
  });

  it('computes local date for last job fetch time in profile timezone', () => {
    const now = new Date('2026-04-29T20:00:00.000Z');
    expect(
      resolveLocalDateForLastFetch(
        { lastJobFetchTime: now.toISOString(), deliveryTimezone: 'Asia/Kolkata' },
        now
      )
    ).toBe('2026-04-30');
  });
});
