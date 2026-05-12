import { describe, expect, it } from 'vitest';
import {
  detectRemoteRegion,
  inferUserCountry,
  isRegionEligibleForCountry,
} from '../remoteEligibility';

describe('detectRemoteRegion — location string', () => {
  it('flags "Remote - United States" as us', () => {
    expect(detectRemoteRegion({ location: 'Remote - United States' })).toBe('us');
  });

  it('flags "Remote (USA)" as us', () => {
    expect(detectRemoteRegion({ location: 'Remote (USA)' })).toBe('us');
  });

  it('flags "Remote, India" as india', () => {
    expect(detectRemoteRegion({ location: 'Remote, India' })).toBe('india');
  });

  it('flags "Remote — EMEA" as eu', () => {
    expect(detectRemoteRegion({ location: 'Remote — EMEA' })).toBe('eu');
  });

  it('flags "Remote / Worldwide" as worldwide', () => {
    expect(detectRemoteRegion({ location: 'Remote / Worldwide' })).toBe('worldwide');
  });

  it('returns unknown for bare "Remote"', () => {
    expect(detectRemoteRegion({ location: 'Remote' })).toBe('unknown');
  });
});

describe('detectRemoteRegion — description', () => {
  it('flags "must be located in the US" in description as us', () => {
    expect(
      detectRemoteRegion({
        location: 'Remote',
        description: 'You must be located in the US to apply.',
      })
    ).toBe('us');
  });

  it('flags US time-zone-only roles as us', () => {
    expect(
      detectRemoteRegion({
        location: 'Remote',
        description: 'Working hours must overlap with Pacific time zone.',
      })
    ).toBe('us');
  });

  it('flags Canada-only clauses as canada', () => {
    expect(
      detectRemoteRegion({
        location: 'Remote',
        description: 'Open to candidates based in Canada only.',
      })
    ).toBe('canada');
  });

  it('falls back to unknown when no clauses present', () => {
    expect(
      detectRemoteRegion({
        location: 'Remote',
        description: 'We build great software.',
      })
    ).toBe('unknown');
  });
});

describe('inferUserCountry', () => {
  it('maps Asia/Kolkata timezone to IN', () => {
    expect(inferUserCountry({ deliveryTimezone: 'Asia/Kolkata' })).toBe('IN');
  });

  it('maps America/New_York to US', () => {
    expect(inferUserCountry({ deliveryTimezone: 'America/New_York' })).toBe('US');
  });

  it('maps Europe/London to GB', () => {
    expect(inferUserCountry({ deliveryTimezone: 'Europe/London' })).toBe('GB');
  });

  it('falls back to UNKNOWN for ambiguous timezones', () => {
    expect(inferUserCountry({ deliveryTimezone: 'UTC' })).toBe('UNKNOWN');
  });

  it('uses locations array when timezone is unset', () => {
    expect(inferUserCountry({ locations: ['Bengaluru, India'] })).toBe('IN');
  });

  it('returns UNKNOWN when nothing is provided', () => {
    expect(inferUserCountry({})).toBe('UNKNOWN');
  });
});

describe('isRegionEligibleForCountry', () => {
  it('rejects a US-only remote job for an India-based user', () => {
    expect(isRegionEligibleForCountry('us', 'IN')).toBe(false);
  });

  it('accepts a US-only remote job for a US-based user', () => {
    expect(isRegionEligibleForCountry('us', 'US')).toBe(true);
  });

  it('accepts a worldwide job for everyone', () => {
    expect(isRegionEligibleForCountry('worldwide', 'IN')).toBe(true);
    expect(isRegionEligibleForCountry('worldwide', 'US')).toBe(true);
  });

  it('accepts an unknown-region job for everyone (conservative)', () => {
    expect(isRegionEligibleForCountry('unknown', 'IN')).toBe(true);
  });

  it('accepts any region when user country is UNKNOWN', () => {
    expect(isRegionEligibleForCountry('us', 'UNKNOWN')).toBe(true);
  });

  it('treats India users as eligible for APAC roles', () => {
    expect(isRegionEligibleForCountry('apac', 'IN')).toBe(true);
  });

  it('treats UK users as eligible for EU roles', () => {
    expect(isRegionEligibleForCountry('eu', 'GB')).toBe(true);
  });
});
