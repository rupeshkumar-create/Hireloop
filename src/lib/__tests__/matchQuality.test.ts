import { describe, expect, it } from 'vitest';
import {
  apifyTitleExclusionsForCareer,
  apifyTitleSynonyms,
  isSupportFocusedCareer,
  passesSupportCompatibilityGate,
} from '../matchQuality.js';
import type { DiscoveredJob } from '../../services/jobResearcher.js';

function job(title: string, overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    fingerprint: `${title}::co`,
    title,
    company: 'Co',
    location: 'Remote',
    workType: 'remote',
    salary: '',
    description: 'Remote role.',
    requirements: [],
    source: 'apifyCareerSite',
    applyUrl: 'https://example.com/jobs/1',
    postedAt: new Date().toISOString(),
    daysOld: 1,
    ...overrides,
  };
}

describe('matchQuality support paths', () => {
  const supportPaths = ['Customer Support', 'Customer Support Specialist'];

  it('detects support-focused careers', () => {
    expect(isSupportFocusedCareer(supportPaths)).toBe(true);
    expect(isSupportFocusedCareer(['Software Engineer'])).toBe(false);
  });

  it('blocks engineering titles for support users', () => {
    expect(passesSupportCompatibilityGate(job('Software Engineer'), supportPaths)).toBe(false);
    expect(passesSupportCompatibilityGate(job('Frontend Engineer'), supportPaths)).toBe(false);
  });

  it('allows support titles for support users', () => {
    expect(passesSupportCompatibilityGate(job('Customer Support Specialist'), supportPaths)).toBe(true);
    expect(passesSupportCompatibilityGate(job('Technical Support Engineer'), supportPaths)).toBe(true);
  });

  it('blocks customer success when path is support-only', () => {
    expect(passesSupportCompatibilityGate(job('Customer Success Manager'), supportPaths)).toBe(false);
  });

  it('adds Apify title synonyms and exclusions for support', () => {
    expect(apifyTitleSynonyms(supportPaths)).toContain('Customer Support');
    expect(apifyTitleExclusionsForCareer(supportPaths)).toContain('Software Engineer');
  });
});
