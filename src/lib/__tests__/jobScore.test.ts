// Unit tests for resolveJobScore — the helper that powers the score badge
// on saved-job cards. Previously fell back to `100` when no real score was
// stored, making every saved card look like a perfect match. These tests
// pin the corrected behaviour: real value when available, null when not.

import { describe, expect, it } from 'vitest';
import { resolveJobScore, scoreVerdict } from '../jobScore';

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

describe('scoreVerdict', () => {
  it('labels 90+ as Perfect fit (accent tone)', () => {
    const v = scoreVerdict(95);
    expect(v.label).toBe('Perfect fit');
    expect(v.tone).toBe('accent');
  });

  it('labels 75-89 as Strong fit (accent tone)', () => {
    expect(scoreVerdict(80).label).toBe('Strong fit');
    expect(scoreVerdict(80).tone).toBe('accent');
  });

  it('labels 60-74 as Reasonable fit (good tone)', () => {
    expect(scoreVerdict(65).label).toBe('Reasonable fit');
    expect(scoreVerdict(65).tone).toBe('good');
  });

  it('labels 40-59 as Stretch (soft tone)', () => {
    expect(scoreVerdict(45).label).toBe('Stretch');
    expect(scoreVerdict(45).tone).toBe('soft');
  });

  it('labels <40 as Off target (soft tone)', () => {
    expect(scoreVerdict(10).label).toBe('Off target');
    expect(scoreVerdict(10).tone).toBe('soft');
  });

  it('treats 0 / NaN / negative as Unscored (no false "Off target")', () => {
    expect(scoreVerdict(0).label).toBe('Unscored');
    expect(scoreVerdict(NaN).label).toBe('Unscored');
    expect(scoreVerdict(-5).label).toBe('Unscored');
  });

  it('handles the boundary cases exactly', () => {
    expect(scoreVerdict(90).label).toBe('Perfect fit');
    expect(scoreVerdict(75).label).toBe('Strong fit');
    expect(scoreVerdict(60).label).toBe('Reasonable fit');
    expect(scoreVerdict(40).label).toBe('Stretch');
    expect(scoreVerdict(39).label).toBe('Off target');
  });
});
