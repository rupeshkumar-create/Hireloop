import { describe, expect, it } from 'vitest';
import {
  hasPublishedToday,
  shouldAutoDispatchToday,
  todayUtcDate,
} from '../ensureDailyPublishLogic';

describe('ensureDailyPublish', () => {
  it('detects posts published today', () => {
    const today = todayUtcDate(new Date('2026-06-07T10:00:00.000Z'));
    expect(
      hasPublishedToday([{ publishedAt: `${today}T08:05:00.000Z` }], new Date('2026-06-07T10:00:00.000Z'))
    ).toBe(true);
    expect(
      hasPublishedToday([{ publishedAt: '2026-06-06T08:05:00.000Z' }], new Date('2026-06-07T10:00:00.000Z'))
    ).toBe(false);
  });

  it('waits until 08:00 UTC before auto-dispatch', () => {
    expect(
      shouldAutoDispatchToday({
        now: new Date('2026-06-07T07:30:00.000Z'),
        posts: [],
      })
    ).toBe(false);
    expect(
      shouldAutoDispatchToday({
        now: new Date('2026-06-07T08:05:00.000Z'),
        posts: [],
      })
    ).toBe(true);
  });

  it('dispatches once per day unless retry window elapsed', () => {
    const now = new Date('2026-06-07T10:00:00.000Z');
    expect(
      shouldAutoDispatchToday({
        now,
        posts: [],
        lastAutoDispatchDate: '2026-06-07',
        lastAutoDispatchAt: '2026-06-07T08:10:00.000Z',
      })
    ).toBe(false);

    expect(
      shouldAutoDispatchToday({
        now: new Date('2026-06-07T12:00:00.000Z'),
        posts: [],
        lastAutoDispatchAt: '2026-06-07T08:10:00.000Z',
      })
    ).toBe(true);
  });
});
