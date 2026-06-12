import { describe, expect, it, vi } from 'vitest';
import {
  buildCronRunId,
  evaluateDueUsers,
  getCronRunDateIST,
  isActiveCronUser,
  isRecentlyActiveUser,
  processUserCronRun,
  queueCronRun,
  shouldPauseForInactivity,
  type CronRunRecord,
} from '../cronEngine';

const recentActiveAt = new Date().toISOString();

describe('isActiveCronUser', () => {
  it('returns true when plan is present, alerts are enabled, and user is recently active', () => {
    expect(
      isActiveCronUser({
        plan: 'pro',
        receiveDailyAlerts: true,
        lastActiveAt: recentActiveAt,
      })
    ).toBe(true);
  });

  it('returns true when plan is omitted (defaults to free)', () => {
    expect(
      isActiveCronUser({
        receiveDailyAlerts: true,
        lastActiveAt: recentActiveAt,
      })
    ).toBe(true);
  });

  it('returns false when alerts are explicitly disabled', () => {
    expect(
      isActiveCronUser({
        plan: 'free',
        receiveDailyAlerts: false,
        lastActiveAt: recentActiveAt,
      })
    ).toBe(false);
  });

  it('returns false when the user has been inactive for more than 3 days', () => {
    const stale = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(
      isActiveCronUser({
        plan: 'pro',
        receiveDailyAlerts: true,
        lastActiveAt: stale,
      })
    ).toBe(false);
  });
});

describe('isRecentlyActiveUser', () => {
  it('returns true when lastActiveAt is missing (legacy profiles)', () => {
    expect(isRecentlyActiveUser({})).toBe(true);
  });
});

describe('shouldPauseForInactivity', () => {
  it('returns true when alerts are on but the user is stale', () => {
    const stale = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(
      shouldPauseForInactivity({
        plan: 'pro',
        receiveDailyAlerts: true,
        lastActiveAt: stale,
      })
    ).toBe(true);
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

describe('evaluateDueUsers', () => {
  it('selects only users whose next delivery time is due', () => {
    const result = evaluateDueUsers(
      [
        {
          id: 'due_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
            deliveryTimezone: 'Asia/Kolkata',
            preferredDeliveryHour: 8,
            nextJobDeliveryAt: '2026-04-24T02:30:00.000Z',
          },
        },
        {
          id: 'later_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
            deliveryTimezone: 'America/New_York',
            preferredDeliveryHour: 12,
            nextJobDeliveryAt: '2026-04-24T16:00:00.000Z',
          },
        },
      ],
      new Date('2026-04-24T03:00:00.000Z')
    );

    expect(result.due.map((user) => user.id)).toEqual(['due_user']);
    expect(result.skipped.map((user) => user.id)).toEqual(['later_user']);
  });
});

describe('processUserCronRun', () => {
  it('marks blocked profiles as skipped using matchReadiness', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
          deliveryTimezone: 'Asia/Kolkata',
          preferredDeliveryHour: 8,
          matchReadiness: {
            status: 'blocked',
            hasResume: false,
            hasCareerPaths: false,
            blockingReason: 'Profile missing usable resume text and career paths.',
            qualityWarnings: [],
          },
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-24',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-24' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.generateJobs).not.toHaveBeenCalled();
  });

  it('ignores stale blocked matchReadiness when current career paths are present', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
          email: 'person@example.com',
          careerPaths: ['Customer Success Manager'],
          resumeText: '',
          seenJobFingerprints: [],
          matchReadiness: {
            status: 'blocked',
            hasResume: false,
            hasCareerPaths: false,
            blockingReason: 'Profile missing usable resume text and career paths.',
            qualityWarnings: [],
          },
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-05-08',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({ jobs: [] }),
      storeJobs: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-05-08', bypassActiveCheck: true },
      deps
    );

    expect(result.status).toBe('completed');
    expect(deps.generateJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        careerPaths: ['Customer Success Manager'],
        matchReadiness: expect.objectContaining({
          status: 'partial',
          hasCareerPaths: true,
        }),
      }),
      10
    );
  });

  it('marks users without email or matching inputs as skipped', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
          email: 'person@example.com',
          careerPaths: [],
          resumeText: '',
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.generateJobs).not.toHaveBeenCalled();
  });

  it('uses structured roles when career paths are missing', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
          email: 'person@example.com',
          careerPaths: [],
          structuredProfile: {
            roles: ['Frontend Engineer', 'UI Engineer'],
          },
          resumeText: '',
          seenJobFingerprints: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({ jobs: [] }),
      storeJobs: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('completed');
    expect(deps.generateJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        careerPaths: ['Frontend Engineer', 'UI Engineer'],
      }),
      10
    );
  });

  it('continues when resume text exists even without career paths', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'free',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
          email: 'person@example.com',
          careerPaths: [],
          resumeText: 'Senior frontend engineer with React, TypeScript, and design systems experience.',
          seenJobFingerprints: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({ jobs: [] }),
      storeJobs: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('completed');
    expect(deps.generateJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        careerPaths: [],
        resumeText: 'Senior frontend engineer with React, TypeScript, and design systems experience.',
      }),
      1
    );
  });

  it('stores jobs after generation completes', async () => {
    const order: string[] = [];

    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
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
      generateJobs: vi.fn().mockImplementation(async () => {
        order.push('generate');
        return {
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
        };
      }),
      storeJobs: vi.fn().mockImplementation(async () => {
        order.push('store');
      }),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('completed');
    expect(order).toEqual(['generate', 'store']);
    expect(deps.generateJobs).toHaveBeenCalledWith(expect.any(Object), 10);
  });

  it('uses the free plan limit for non-pro users', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_free',
        data: {
          plan: 'free',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
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
    };

    await processUserCronRun({ userId: 'user_free', runDate: '2026-04-16' }, deps);

    expect(deps.generateJobs).toHaveBeenCalledWith(expect.any(Object), 1);
  });

  it('does not re-process a completed run that already delivered jobs', async () => {
    const deps = {
      loadUser: vi.fn(),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'completed',
        jobsStored: 2,
      } as CronRunRecord),
      markRun: vi.fn(),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.loadUser).not.toHaveBeenCalled();
  });

  it('retries a completed run that stored zero jobs', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'free',
          receiveDailyAlerts: true,
          lastActiveAt: recentActiveAt,
          careerPaths: ['Software Engineer'],
          resumeText: 'Built React apps with TypeScript for five years.',
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'completed',
        jobsStored: 0,
      } as CronRunRecord),
      markRun: vi.fn(),
      generateJobs: vi.fn().mockResolvedValue({ jobs: [{ title: 'Engineer', company: 'Acme' }] }),
      storeJobs: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('completed');
    expect(deps.generateJobs).toHaveBeenCalled();
  });

  it('marks the run failed when storage throws', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'free',
          receiveDailyAlerts: true,
            lastActiveAt: recentActiveAt,
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
      storeJobs: vi.fn().mockRejectedValue(new Error('firestore unavailable')),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('failed');
    expect(deps.storeJobs).toHaveBeenCalledTimes(1);
  });
});
