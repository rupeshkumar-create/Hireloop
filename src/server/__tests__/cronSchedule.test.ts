import { describe, expect, it } from 'vitest';
import {
  CRON_JOBS,
  getDueCronJobs,
  isCronJobDue,
  VERCEL_FUNCTION_COUNT,
  VERCEL_FUNCTION_LIMIT,
} from '../cronSchedule';

describe('cronSchedule', () => {
  it('stays within the Vercel Hobby function limit', () => {
    expect(VERCEL_FUNCTION_COUNT).toBeLessThanOrEqual(VERCEL_FUNCTION_LIMIT);
    expect(VERCEL_FUNCTION_LIMIT).toBe(12);
  });

  it('marks daily jobs due when tick fires at 08:00 UTC', () => {
    const now = new Date('2026-06-03T08:00:00.000Z'); // Tuesday
    expect(isCronJobDue(CRON_JOBS.find((j) => j.id === 'daily-alerts')!, now)).toBe(true);
    expect(isCronJobDue(CRON_JOBS.find((j) => j.id === 'daily-blog')!, now)).toBe(false);
    expect(getDueCronJobs(now).map((j) => j.id)).toEqual(['daily-alerts']);
  });

  it('marks daily blog due after 08:05 UTC', () => {
    const now = new Date('2026-06-03T08:05:00.000Z');
    expect(isCronJobDue(CRON_JOBS.find((j) => j.id === 'daily-blog')!, now)).toBe(true);
    expect(getDueCronJobs(now).map((j) => j.id)).toContain('daily-blog');
  });

  it('still runs daily jobs later the same UTC day (catch-up for late cron)', () => {
    const schedule = CRON_JOBS.find((j) => j.id === 'daily-alerts')!;
    const now = new Date('2026-06-06T10:00:00.000Z');
    expect(isCronJobDue(schedule, now)).toBe(true);
    expect(getDueCronJobs(now).map((j) => j.id)).toContain('daily-blog');
  });

  it('skips daily jobs before the scheduled hour', () => {
    const schedule = CRON_JOBS.find((j) => j.id === 'daily-alerts')!;
    const now = new Date('2026-06-06T07:30:00.000Z');
    expect(isCronJobDue(schedule, now)).toBe(false);
  });

  it('runs weekly analysis only on Saturday', () => {
    const schedule = CRON_JOBS.find((j) => j.id === 'weekly-analysis')!;
    expect(isCronJobDue(schedule, new Date('2026-06-06T08:00:00.000Z'))).toBe(true);
    expect(isCronJobDue(schedule, new Date('2026-06-05T08:00:00.000Z'))).toBe(false);
  });

  it('getDueCronJobs returns all jobs when forced', () => {
    expect(getDueCronJobs(new Date('2026-01-01T03:00:00.000Z'), { force: 'all' })).toHaveLength(4);
  });
});
