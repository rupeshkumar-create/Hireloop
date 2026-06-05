import { describe, expect, it } from 'vitest';
import type { Job } from '../../types/dashboard';
import { resolveJobApplicationUrl } from '../jobLinks';

const baseJob: Job = {
  id: 'job-1',
  fingerprint: 'job-1',
  title: 'Customer Success Operations Manager',
  company: 'Superside',
  location: 'Remote',
  workType: 'remote',
  salary: '$65,000 - $85,000',
  description: 'Coordinate customer success operations',
  requirements: [],
  source: 'perplexity',
  postedAt: new Date().toISOString(),
  matchScore: 92,
  finalScore: 92,
  matchReasons: [],
  skillGaps: [],
  aiSummary: '',
  isHotJob: false,
};

describe('resolveJobApplicationUrl', () => {
  it('uses applyUrl when present', () => {
    expect(
      resolveJobApplicationUrl({ ...baseJob, applyUrl: 'https://example.com/apply' })
    ).toBe('https://example.com/apply');
  });

  it('falls back to url when applyUrl is missing', () => {
    expect(
      resolveJobApplicationUrl({ ...(baseJob as any), url: 'https://example.com/url' })
    ).toBe('https://example.com/url');
  });

  it('returns null when no valid application url exists', () => {
    expect(resolveJobApplicationUrl(baseJob)).toBeNull();
    expect(
      resolveJobApplicationUrl({ ...(baseJob as any), applyUrl: 'not-a-link' })
    ).toBeNull();
  });
});
