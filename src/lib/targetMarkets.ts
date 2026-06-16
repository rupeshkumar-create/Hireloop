/**
 * Target hiring markets — drives Apify discovery bias and match ranking.
 */
import type { RemoteRegion } from '../services/remoteEligibility.js';
import { detectRemoteRegion } from '../services/remoteEligibility.js';
import type { DiscoveredJob } from '../services/jobResearcher.js';

export type TargetMarket = 'us' | 'eu' | 'uk' | 'ca' | 'worldwide';

export const TARGET_MARKET_OPTIONS: { id: TargetMarket; label: string; description: string }[] = [
  { id: 'us', label: 'United States', description: 'US-remote and US-overlap roles' },
  { id: 'eu', label: 'Europe', description: 'EU / EMEA remote-friendly employers' },
  { id: 'uk', label: 'United Kingdom', description: 'UK-remote and GBP-denominated roles' },
  { id: 'ca', label: 'Canada', description: 'Canada-remote and North America overlap' },
  { id: 'worldwide', label: 'Worldwide', description: 'No extra regional boost (broadest pool)' },
];

/** Default for new users — US & Europe first. */
export const DEFAULT_TARGET_MARKETS: TargetMarket[] = ['us', 'eu', 'uk'];

export interface TargetMarketProfile {
  targetMarkets?: TargetMarket[];
}

export function normalizeTargetMarkets(value: unknown): TargetMarket[] {
  const allowed = new Set<TargetMarket>(['us', 'eu', 'uk', 'ca', 'worldwide']);
  if (!Array.isArray(value)) return [...DEFAULT_TARGET_MARKETS];
  const out = value.filter((v): v is TargetMarket => typeof v === 'string' && allowed.has(v as TargetMarket));
  return out.length > 0 ? out : [...DEFAULT_TARGET_MARKETS];
}

export function resolveTargetMarkets(profile: TargetMarketProfile | null | undefined): TargetMarket[] {
  return normalizeTargetMarkets(profile?.targetMarkets);
}

/** Apify `locationSearch` tokens for strict discovery passes. */
export function apifyLocationSearchForMarkets(markets: TargetMarket[]): string[] {
  if (markets.includes('worldwide')) {
    return ['United States', 'United Kingdom', 'Germany', 'Canada', 'Remote'];
  }
  const terms: string[] = [];
  if (markets.includes('us')) terms.push('United States', 'US', 'USA', 'Remote US');
  if (markets.includes('ca')) terms.push('Canada', 'Remote Canada');
  if (markets.includes('uk')) terms.push('United Kingdom', 'UK', 'Remote UK');
  if (markets.includes('eu')) {
    terms.push('Europe', 'EU', 'EMEA', 'Germany', 'Netherlands', 'France', 'Ireland', 'Remote Europe');
  }
  return [...new Set(terms)].slice(0, 12);
}

function regionMatchesMarkets(region: RemoteRegion, markets: TargetMarket[]): boolean {
  if (markets.includes('worldwide')) return true;
  if (region === 'worldwide' || region === 'unknown') return true;
  if (region === 'us' || region === 'na') return markets.includes('us') || markets.includes('ca');
  if (region === 'canada') return markets.includes('ca') || markets.includes('us');
  if (region === 'uk') return markets.includes('uk') || markets.includes('eu');
  if (region === 'eu') return markets.includes('eu') || markets.includes('uk');
  if (region === 'india' || region === 'apac' || region === 'latam') return false;
  return true;
}

function inferJobMarketRegion(job: DiscoveredJob): RemoteRegion {
  const region = detectRemoteRegion({
    location: job.location || '',
    description: job.description || '',
  });
  if (region !== 'unknown' && region !== 'worldwide') return region;

  const loc = `${job.location || ''} ${job.description || ''}`.toLowerCase();
  if (/\bindia\b|bangalore|mumbai|delhi|hyderabad|chennai|pune\b/.test(loc)) return 'india';
  if (/\b(united states|u\.s\.|usa)\b/.test(loc)) return 'us';
  if (/\b(united kingdom|u\.k\.|england)\b/.test(loc)) return 'uk';
  if (/\b(europe|emea|germany|france|netherlands|ireland)\b/.test(loc)) return 'eu';
  if (/\bcanada\b/.test(loc)) return 'canada';

  return region;
}

/** Sort boost (points) applied before final job selection. */
export function marketBoostForJob(job: DiscoveredJob, markets: TargetMarket[]): number {
  if (markets.includes('worldwide')) return 0;

  const region = inferJobMarketRegion(job);

  if (regionMatchesMarkets(region, markets)) {
    if (region === 'us' || region === 'na') return 12;
    if (region === 'eu' || region === 'uk') return 10;
    if (region === 'canada') return 8;
    if (region === 'worldwide' || region === 'unknown') return 3;
    return 0;
  }

  // Deprioritize markets outside target (e.g. India-only when US/EU selected).
  if (region === 'india' || region === 'apac') return -15;
  if (region === 'latam') return -6;
  return -8;
}

export function isIndiaOnlyDiscoveryMarket(markets: TargetMarket[]): boolean {
  return markets.length === 0;
}
