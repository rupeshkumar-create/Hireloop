import { describe, expect, it, vi } from 'vitest';
import {
  buildCronRunId,
  getCronRunDateIST,
  isActiveCronUser,
  processUserCronRun,
  queueCronRun,
  type CronRunRecord,
} from '../cronEngine';

describe('isActiveCronUser', () => {
  it('returns true when plan is present and alerts are enabled', () => {
    expect(
      isActiveCronUser({
        plan: 'pro',
        receiveDailyAlerts: true,
      })
    ).toBe(true);
  });

  it('returns false when the plan is missing', () => {
    expect(
      isActiveCronUser({
        receiveDailyAlerts: true,
      })
    ).toBe(false);
  });

  it('returns false when alerts are explicitly disabled', () => {
    expect(
      isActiveCronUser({
        plan: 'free',
        receiveDailyAlerts: false,
      })
    ).toBe(false);
  });
});

describe('getCronRunDateIST', () => {
  it('uses the IST calendar day instead of raw UTC midnight', () => {
    expect(getCronRunDateIST(new Date('2026-04-16T02:30:00.000Z'))).toBe('2026-04-16');
    expect(getCronRunDateIST(new Date('2026-04-15T21:00:00.000Z'))).toBe('2026-04-16');
  });
});

describe('buildCronRunId', () => {
  it('builds a deterministic user-day identifier', () => {
    expect(buildCronRunId('user_123', '2026-04-16')).toBe('user_123_2026-04-16');
  });
});

describe('queueCronRun', () => {
  it('creates a queued run only once per user and run date', async () => {
    const createRun = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const first = await queueCronRun(
      { userId: 'user_123', runDate: '2026-04-16', plan: 'pro', email: 'person@example.com' },
      { createRun }
    );
    const second = await queueCronRun(
      { userId: 'user_123', runDate: '2026-04-16', plan: 'pro', email: 'person@example.com' },
      { createRun }
    );

    expect(first.status).toBe('queued');
    expect(second.status).toBe('duplicate');
  });
});

describe('processUserCronRun', () => {
  it('marks incomplete users as skipped', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
          email: 'person@example.com',
          careerPaths: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
      sendDailyEmail: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.generateJobs).not.toHaveBeenCalled();
    expect(deps.sendDailyEmail).not.toHaveBeenCalled();
  });

  it('stores jobs before sending email', async () => {
    const order: string[] = [];

    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
          email: 'person@example.com',
          careerPaths: ['Frontend Engineer'],
          jobType: 'both',
          minSalary: null,
          resumeText: '',
          location: '',
          learningProfile: {},
          learningSignals: undefined,
          seenJobFingerprints: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({
        jobs: [
          {
            title: 'Frontend Engineer',
            company: 'Acme',
            location: 'Remote',
            salary: 'Competitive',
            description: 'Build UI',
            url: 'https://jobs.example.com/1',
            requirements: [],
            matchScore: 92,
            datePosted: '2026-04-16T00:00:00.000Z',
          },
        ],
        requestedLimit: 10,
        usedBackfill: false,
        totalValidatedJobs: 1,
        unseenCount: 1,
        seenCount: 0,
      }),
      storeJobs: vi.fn().mockImplementation(async () => {
        order.push('store');
      }),
      sendDailyEmail: vi.fn().mockImplementation(async () => {
        order.push('email');
      }),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('completed');
    expect(order).toEqual(['store', 'email']);
    expect(deps.generateJobs).toHaveBeenCalledWith(expect.any(Object), 10);
  });

  it('uses the free plan limit for non-pro users', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_free',
        data: {
          plan: 'free',
          receiveDailyAlerts: true,
          email: 'free@example.com',
          careerPaths: ['Frontend Engineer'],
          seenJobFingerprints: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_free_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({ jobs: [] }),
      storeJobs: vi.fn().mockResolvedValue(undefined),
      sendDailyEmail: vi.fn().mockResolvedValue(undefined),
    };

    await processUserCronRun({ userId: 'user_free', runDate: '2026-04-16' }, deps);

    expect(deps.generateJobs).toHaveBeenCalledWith(expect.any(Object), 1);
  });

  it('does not re-process a completed run', async () => {
    const deps = {
      loadUser: vi.fn(),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'completed',
      } as CronRunRecord),
      markRun: vi.fn(),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
      sendDailyEmail: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.loadUser).not.toHaveBeenCalled();
  });

  it('marks the run failed when email delivery fails after storage', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'free',
          receiveDailyAlerts: true,
          email: 'person@example.com',
          careerPaths: ['Frontend Engineer'],
          seenJobFingerprints: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({
        jobs: [
          {
            title: 'Frontend Engineer',
            company: 'Acme',
            location: 'Remote',
            salary: 'Competitive',
            description: 'Build UI',
            url: 'https://jobs.example.com/1',
            requirements: [],
            matchScore: 92,
            datePosted: '2026-04-16T00:00:00.000Z',
          },
        ],
      }),
      storeJobs: vi.fn().mockResolvedValue(undefined),
      sendDailyEmail: vi.fn().mockRejectedValue(new Error('smtp failed')),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('failed');
    expect(deps.storeJobs).toHaveBeenCalledTimes(1);
    expect(deps.sendDailyEmail).toHaveBeenCalledTimes(1);
  });
});
