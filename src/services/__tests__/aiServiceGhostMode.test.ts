import { describe, expect, it } from 'vitest';
import { toGenerateDailyJobsResult } from '../aiService';
import type { DailyJobsDebugResult } from '../../types/adminGhostMode';

const debugResult: DailyJobsDebugResult = {
  queries: ['frontend engineer remote react'],
  harvestedCount: 8,
  dedupedCount: 6,
  validatedCount: 4,
  unseenCount: 3,
  seenCount: 1,
  usedBackfill: true,
  acceptedJobs: [],
  rejectedJobs: [],
  rejectionCodeCounts: {},
  finalJobs: [
    {
      title: 'Senior Frontend Engineer',
      company: 'Acme',
      location: 'Remote',
      salary: '$180k',
      description: 'Build product features',
      url: 'https://jobs.example.com/acme',
      requirements: ['React'],
      finalScore: 94,
    },
  ],
};

describe('toGenerateDailyJobsResult', () => {
  it('preserves the existing public return shape for normal callers', () => {
    expect(toGenerateDailyJobsResult(debugResult, 10)).toEqual({
      jobs: debugResult.finalJobs,
      requestedLimit: 10,
      usedBackfill: true,
      totalValidatedJobs: 4,
      unseenCount: 3,
      seenCount: 1,
    });
  });
});
