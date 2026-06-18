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
    postedAt: new Date().toISOString(),
    daysOld: 1,
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
      postedAt: new Date().toISOString(),
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
      postedAt: new Date().toISOString(),
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

  it('excludes software engineering jobs for customer support career paths', async () => {
    const noise = discoveredJob({ title: 'Software Engineer', fingerprint: 'software-engineer::noise' });
    const good = discoveredJob({
      title: 'Customer Support Specialist',
      fingerprint: 'customer-support-specialist::helpco',
      company: 'HelpCo',
      description: 'Handle tickets, chat, and email for SaaS customers.',
    });

    const result = await matchAndRankJobs(
      [noise, good],
      {
        careerPaths: ['Customer Support'],
        resumeText: 'Customer support specialist with Zendesk and SaaS experience.',
        limit: 10,
        minMatchScore: 50,
      }
    );

    expect(result.jobs.some((j) => j.title.includes('Software Engineer'))).toBe(false);
    expect(result.jobs.some((j) => j.title.includes('Customer Support'))).toBe(true);
  });
});
