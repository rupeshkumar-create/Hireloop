import { describe, expect, it } from 'vitest';
import { matchAndRankJobs, passesCareerPathGate } from '../jobMatchingEngine';
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

  it('allows niche non-tech career paths like Category Manager', () => {
    const job: DiscoveredJob = {
      fingerprint: 'category-manager::brandco',
      title: 'Remote Category Manager',
      company: 'BrandCo',
      location: 'Remote',
      workType: 'unknown',
      salary: '$85,000',
      description: 'Lead category strategy for fashion e-commerce assortment.',
      requirements: ['merchandising', 'e-commerce'],
      source: 'apifyCareerSite',
      postedAt: '2026-06-01T00:00:00.000Z',
      daysOld: 2,
    };

    expect(
      passesCareerPathGate({
        job,
        careerPaths: ['Category Manager - Fashion E-commerce'],
      })
    ).toBe(true);
  });

  it('matches category manager roles with remote-only preferences', async () => {
    const job: DiscoveredJob = {
      fingerprint: 'category-manager::brandco',
      title: 'Category Manager',
      company: 'BrandCo',
      location: 'Remote - Worldwide',
      workType: 'unknown',
      salary: '$90,000',
      description: 'Own category P&L for fashion and lifestyle brands.',
      requirements: ['merchandising'],
      source: 'apifyCareerSite',
      applyUrl: 'https://example.com/jobs/category-manager',
      postedAt: '2026-06-01T00:00:00.000Z',
      daysOld: 1,
    };

    const result = await matchAndRankJobs(
      [job],
      {
        careerPaths: ['Category Manager - Fashion E-commerce'],
        resumeText: 'Category manager with fashion e-commerce and merchandising experience.',
        limit: 10,
        minMatchScore: 55,
        matchingPreferences: { remoteOnly: true, salaryFloor: 30000 },
      }
    );

    expect(result.jobs.length).toBeGreaterThan(0);
  });
});
