import { describe, expect, it, vi } from 'vitest';
import {
  buildCronRunId,
  evaluateActivityGate,
  evaluateDueUsers,
  getCronRunDateIST,
  INACTIVITY_PAUSE_DAYS,
  isActiveCronUser,
  processUserCronRun,
  queueCronRun,
  type CronRunRecord,
} from '../cronEngine';

const DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_NOW = new Date('2026-05-30T03:00:00.000Z');
const isoDaysAgo = (days: number) =>
  new Date(FIXED_NOW.getTime() - days * DAY_MS).toISOString();

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

describe('evaluateDueUsers', () => {
  it('selects only users whose next delivery time is due', () => {
    const result = evaluateDueUsers(
      [
        {
          id: 'due_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
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

describe('evaluateActivityGate', () => {
  it('keeps users active (returns null) when lastActiveAt is within the inactivity window', () => {
    const gate = evaluateActivityGate(
      { lastActiveAt: isoDaysAgo(INACTIVITY_PAUSE_DAYS) },
      FIXED_NOW
    );
    expect(gate).toBeNull();
  });

  it('auto-pauses users who crossed the inactivity window', () => {
    const gate = evaluateActivityGate(
      { lastActiveAt: isoDaysAgo(INACTIVITY_PAUSE_DAYS + 1) },
      FIXED_NOW
    );
    expect(gate).toMatchObject({
      reason: 'inactive_3_days',
      shouldPersistPause: true,
    });
  });

  it('keeps already-paused users paused without re-persisting', () => {
    const gate = evaluateActivityGate(
      {
        dailyAlertsAutoPaused: true,
        // Even with very recent activity, the pause flag wins until the user
        // clicks "Resume daily alerts" — opening the app is intentionally
        // not enough on its own.
        lastActiveAt: FIXED_NOW.toISOString(),
      },
      FIXED_NOW
    );
    expect(gate).toMatchObject({
      reason: 'auto_paused',
      shouldPersistPause: false,
    });
  });

  it('falls back to createdAt when lastActiveAt is missing', () => {
    const gate = evaluateActivityGate(
      { createdAt: isoDaysAgo(INACTIVITY_PAUSE_DAYS + 2) },
      FIXED_NOW
    );
    expect(gate).not.toBeNull();
  });

  it('does not pause users with no activity timestamps at all', () => {
    // Conservative: a profile with no timestamps shouldn't be auto-paused
    // on the first cron run. The fields will populate within a day.
    const gate = evaluateActivityGate({}, FIXED_NOW);
    expect(gate).toBeNull();
  });
});

describe('evaluateDueUsers — inactivity bucket', () => {
  it('routes inactive users to the inactive bucket and out of due/skipped', () => {
    const result = evaluateDueUsers(
      [
        {
          id: 'active_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            deliveryTimezone: 'Asia/Kolkata',
            preferredDeliveryHour: 8,
            nextJobDeliveryAt: '2026-05-30T02:30:00.000Z',
            lastActiveAt: isoDaysAgo(1),
          },
        },
        {
          id: 'inactive_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            deliveryTimezone: 'Asia/Kolkata',
            preferredDeliveryHour: 8,
            nextJobDeliveryAt: '2026-05-30T02:30:00.000Z',
            lastActiveAt: isoDaysAgo(INACTIVITY_PAUSE_DAYS + 2),
          },
        },
        {
          id: 'already_paused_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            deliveryTimezone: 'Asia/Kolkata',
            preferredDeliveryHour: 8,
            nextJobDeliveryAt: '2026-05-30T02:30:00.000Z',
            lastActiveAt: isoDaysAgo(0),
            dailyAlertsAutoPaused: true,
          },
        },
      ],
      FIXED_NOW
    );

    expect(result.due.map((u) => u.id)).toEqual(['active_user']);
    expect(result.inactive.map((u) => u.id).sort()).toEqual([
      'already_paused_user',
      'inactive_user',
    ]);
    expect(result.skipped.map((u) => u.id)).toEqual([]);
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
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.loadUser).not.toHaveBeenCalled();
  });

  it('skips inactive users without calling generateJobs', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_inactive',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
          email: 'inactive@example.com',
          careerPaths: ['Frontend Engineer'],
          resumeText: 'experienced engineer with React',
          seenJobFingerprints: [],
          lastActiveAt: isoDaysAgo(INACTIVITY_PAUSE_DAYS + 1),
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_inactive_2026-05-30',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_inactive', runDate: '2026-05-30' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.generateJobs).not.toHaveBeenCalled();
    expect(deps.markRun).toHaveBeenCalledWith(
      'user_inactive_2026-05-30',
      expect.objectContaining({
        status: 'skipped',
        inactivityReason: 'inactive_3_days',
      })
    );
  });

  it('still runs for an inactive user when bypassActiveCheck is true (manual resume)', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_inactive',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
          email: 'inactive@example.com',
          careerPaths: ['Frontend Engineer'],
          resumeText: 'experienced engineer with React',
          seenJobFingerprints: [],
          lastActiveAt: isoDaysAgo(INACTIVITY_PAUSE_DAYS + 5),
          dailyAlertsAutoPaused: true,
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue(null),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({ jobs: [] }),
      storeJobs: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processUserCronRun(
      { userId: 'user_inactive', runDate: '2026-05-30', bypassActiveCheck: true },
      deps
    );

    expect(result.status).toBe('completed');
    expect(deps.generateJobs).toHaveBeenCalledTimes(1);
  });

  it('marks the run failed when storage throws', async () => {
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
