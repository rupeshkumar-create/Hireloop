import { describe, expect, it } from 'vitest';
import { matchAndRankJobs } from '../jobMatchingEngine';
import type { DiscoveredJob } from '../jobResearcher';

function discoveredJob(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    fingerprint: 'frontend-engineer::acme',
    jobId: 'job_1',
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    workType: 'remote',
    salary: '',
    description: 'Build React and TypeScript interfaces for customer-facing products.',
    requirements: ['React', 'TypeScript'],
    source: 'apifyCareerSite',
    applyUrl: 'https://example.com/jobs/frontend',
    postedAt: '2026-05-07T00:00:00.000Z',
    daysOld: 0,
    ...overrides,
  };
}

describe('matchAndRankJobs', () => {
  it('falls back to seen jobs instead of returning empty results when all discovered jobs were already seen', async () => {
    const result = await matchAndRankJobs(
      [discoveredJob()],
      {
        careerPaths: ['Frontend Engineer'],
        resumeText: 'React TypeScript frontend engineer',
        seenFingerprints: ['frontend-engineer::acme'],
        limit: 10,
        minMatchScore: 50,
      }
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.usedFallback).toBe(true);
    expect(result.scoredCount).toBe(1);
  });

  it('backfills with relaxed scores when strict threshold would return zero jobs', async () => {
    const result = await matchAndRankJobs(
      [discoveredJob()],
      {
        careerPaths: ['Frontend Engineer'],
        resumeText: 'React TypeScript frontend engineer',
        limit: 1,
        minMatchScore: 95,
      }
    );

    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.usedFallback).toBe(true);
  });
});
