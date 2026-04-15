import { describe, expect, it, vi } from 'vitest';
import {
  assertGhostModeProfileReady,
  buildGhostModeProfileInput,
  runAdminGhostMode,
} from '../adminGhostMode';

const targetUser = {
  id: 'user_123',
  email: 'person@example.com',
  plan: 'pro' as const,
  careerPaths: ['Frontend Engineer'],
  jobType: 'remote',
  minSalary: 150000,
  resumeText: 'Built React apps',
  location: 'United States',
  seenJobFingerprints: ['seen role::seen co'],
  learningProfile: { jobPreferences: 'prefers React roles' },
  learningSignals: { likedKeywords: ['react'], dislikedKeywords: ['php'] },
};

const debugResult = {
  queries: ['frontend engineer remote react'],
  harvestedCount: 4,
  dedupedCount: 3,
  validatedCount: 2,
  unseenCount: 1,
  seenCount: 1,
  usedBackfill: false,
  acceptedJobs: [],
  rejectedJobs: [],
  rejectionCodeCounts: {},
  finalJobs: [
    {
      title: 'Frontend Engineer',
      company: 'Acme',
      location: 'Remote',
      salary: '$180k',
      description: 'Build product features',
      url: 'https://jobs.example.com/acme',
      requirements: ['React'],
    },
  ],
};

describe('buildGhostModeProfileInput', () => {
  it('applies override values without mutating the target user', () => {
    const result = buildGhostModeProfileInput(targetUser, 'override', {
      location: 'Germany',
      careerPaths: ['Product Engineer'],
    });

    expect(result.location).toBe('Germany');
    expect(result.careerPaths).toEqual(['Product Engineer']);
    expect(targetUser.location).toBe('United States');
  });
});

describe('assertGhostModeProfileReady', () => {
  it('throws when required career paths are missing', () => {
    expect(() =>
      assertGhostModeProfileReady({
        ...buildGhostModeProfileInput(targetUser, 'saved'),
        careerPaths: [],
      })
    ).toThrow('Career paths are required before running Ghost Mode.');
  });
});

describe('runAdminGhostMode', () => {
  it('does not persist or log during preview runs', async () => {
    const persistDailyJobs = vi.fn();
    const logRun = vi.fn();

    const result = await runAdminGhostMode(
      {
        targetUser,
        admin: { uid: 'admin_1', email: 'admin@example.com' },
        runMode: 'preview',
        inputMode: 'saved',
      },
      {
        generateDebugResult: vi.fn().mockResolvedValue(debugResult),
        persistDailyJobs,
        logRun,
        now: () => '2026-04-16T08:00:00.000Z',
      }
    );

    expect(result.persisted).toBe(false);
    expect(persistDailyJobs).not.toHaveBeenCalled();
    expect(logRun).not.toHaveBeenCalled();
  });

  it('persists results and writes an admin log during persist runs', async () => {
    const persistDailyJobs = vi.fn();
    const logRun = vi.fn();

    await runAdminGhostMode(
      {
        targetUser,
        admin: { uid: 'admin_1', email: 'admin@example.com' },
        runMode: 'persist',
        inputMode: 'override',
        overrides: {
          location: 'Canada',
        },
      },
      {
        generateDebugResult: vi.fn().mockResolvedValue(debugResult),
        persistDailyJobs,
        logRun,
        now: () => '2026-04-16T08:00:00.000Z',
      }
    );

    expect(persistDailyJobs).toHaveBeenCalledWith({
      userId: 'user_123',
      jobs: debugResult.finalJobs,
      lastJobFetchTime: '2026-04-16T08:00:00.000Z',
      seenJobFingerprints: ['seen role::seen co', 'frontend engineer::acme'],
      runDate: '2026-04-16',
    });
    expect(logRun).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'simulate_daily_jobs',
        runMode: 'persist',
        inputMode: 'override',
        overrideKeys: ['location'],
        finalCount: 1,
      })
    );
  });
});
