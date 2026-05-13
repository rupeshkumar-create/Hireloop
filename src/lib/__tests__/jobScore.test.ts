// Unit tests for resolveJobScore — the helper that powers the score badge
// on saved-job cards. Previously fell back to `100` when no real score was
// stored, making every saved card look like a perfect match. These tests
// pin the corrected behaviour: real value when available, null when not.

import { describe, expect, it } from 'vitest';
import { resolveJobScore } from '../jobScore';

describe('resolveJobScore', () => {
  it('returns matchScore when present and positive', () => {
    expect(resolveJobScore({ matchScore: 87 })).toBe(87);
  });

  it('returns finalScore when only finalScore is present', () => {
    expect(resolveJobScore({ finalScore: 72 })).toBe(72);
  });

  it('prefers matchScore over finalScore when both exist', () => {
    expect(resolveJobScore({ matchScore: 91, finalScore: 70 })).toBe(91);
  });

  it('returns null when both are missing (not 100 anymore)', () => {
    expect(resolveJobScore({})).toBeNull();
  });

  it('returns null when matchScore is 0 (treat as unscored, not "best match")', () => {
    expect(resolveJobScore({ matchScore: 0 })).toBeNull();
  });

  it('returns null when both values are non-numeric', () => {
    // @ts-expect-error — exercising defensive handling of bad data
    expect(resolveJobScore({ matchScore: 'high' })).toBeNull();
  });

  it('clamps anomalously high scores to 100', () => {
    expect(resolveJobScore({ matchScore: 250 })).toBe(100);
  });

  it('rounds fractional scores to the nearest integer', () => {
    expect(resolveJobScore({ matchScore: 87.6 })).toBe(88);
  });
});
