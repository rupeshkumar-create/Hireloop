import { describe, expect, it } from 'vitest';
import {
  apifyLocationSearchForMarkets,
  apifyLocationSearchForUser,
  marketBoostForJob,
  normalizeTargetMarkets,
  DEFAULT_TARGET_MARKETS,
} from '../targetMarkets.js';
import type { DiscoveredJob } from '../../services/jobResearcher.js';

function job(location: string): DiscoveredJob {
  return {
    fingerprint: `eng::acme`,
    title: 'Software Engineer',
    company: 'Acme',
    location,
    workType: 'remote',
    salary: '',
    description: location,
    requirements: [],
    source: 'apifyCareerSite',
    postedAt: new Date().toISOString(),
    daysOld: 1,
  };
}

describe('targetMarkets', () => {
  it('defaults to us, eu, uk', () => {
    expect(normalizeTargetMarkets(undefined)).toEqual(DEFAULT_TARGET_MARKETS);
    expect(normalizeTargetMarkets([])).toEqual(DEFAULT_TARGET_MARKETS);
  });

  it('builds Apify location search for US/EU markets', () => {
    const terms = apifyLocationSearchForMarkets(['us', 'eu', 'uk']);
    expect(terms.some((t) => /United States/i.test(t))).toBe(true);
    expect(terms.some((t) => /Europe|Germany/i.test(t))).toBe(true);
    expect(terms.some((t) => /United Kingdom|UK/i.test(t))).toBe(true);
  });

  it('boosts US jobs and penalizes India-only when US/EU selected', () => {
    const markets = ['us', 'eu', 'uk'] as const;
    expect(marketBoostForJob(job('Remote — United States'), [...markets])).toBeGreaterThan(0);
    expect(marketBoostForJob(job('Bangalore, India — Remote'), [...markets])).toBeLessThan(0);
  });
});

describe('apifyLocationSearchForUser', () => {
  it('adds India and worldwide tokens for Indian users', () => {
    const terms = apifyLocationSearchForUser(['us', 'eu', 'uk'], 'IN');
    expect(terms.some((t) => /india|worldwide|apac/i.test(t))).toBe(true);
  });

  it('keeps US-only tokens for US users', () => {
    const terms = apifyLocationSearchForUser(['us', 'eu', 'uk'], 'US');
    expect(terms.some((t) => /united states|usa/i.test(t))).toBe(true);
    expect(terms.some((t) => /india/i.test(t))).toBe(false);
  });
});
