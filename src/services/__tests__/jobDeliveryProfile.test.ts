import { describe, expect, it } from 'vitest';
import {
  computeMatchReadiness,
  computeNextJobDeliveryAt,
  evaluateDueDailyRun,
  normalizeDeliverySettings,
} from '../jobDeliveryProfile';

describe('normalizeDeliverySettings', () => {
  it('defaults to UTC and 8 AM when settings are missing', () => {
    expect(normalizeDeliverySettings({})).toEqual({
      deliveryTimezone: 'UTC',
      preferredDeliveryHour: 8,
    });
  });
});

describe('computeMatchReadiness', () => {
  it('blocks when both resume text and career paths are missing', () => {
    expect(
      computeMatchReadiness({
        resumeText: '',
        careerPaths: [],
      })
    ).toEqual(
      expect.objectContaining({
        status: 'blocked',
        hasResume: false,
        hasCareerPaths: false,
      })
    );
  });

  it('marks the profile partial when career paths exist without a usable resume', () => {
    expect(
      computeMatchReadiness({
        resumeText: 'short',
        careerPaths: ['Frontend Engineer'],
      })
    ).toEqual(
      expect.objectContaining({
        status: 'partial',
        hasCareerPaths: true,
      })
    );
  });
});

describe('evaluateDueDailyRun', () => {
  it('returns due when local time has passed the preferred hour and no success exists for that date', () => {
    const result = evaluateDueDailyRun(
      {
        deliveryTimezone: 'Asia/Kolkata',
        preferredDeliveryHour: 8,
        lastSuccessfulJobRunLocalDate: '2026-04-23',
      },
      new Date('2026-04-24T03:00:00.000Z')
    );

    expect(result).toEqual(
      expect.objectContaining({
        due: true,
        localDate: '2026-04-24',
      })
    );
  });

  it('returns not due when the user already completed the local day', () => {
    const result = evaluateDueDailyRun(
      {
        deliveryTimezone: 'Asia/Kolkata',
        preferredDeliveryHour: 8,
        lastSuccessfulJobRunLocalDate: '2026-04-24',
      },
      new Date('2026-04-24T03:00:00.000Z')
    );

    expect(result).toEqual(
      expect.objectContaining({
        due: false,
        reason: 'ALREADY_COMPLETED',
      })
    );
  });
});

describe('computeNextJobDeliveryAt', () => {
  it('returns an ISO timestamp after the current successful run window', () => {
    const next = computeNextJobDeliveryAt('Asia/Kolkata', 8, new Date('2026-04-24T03:00:00.000Z'));
    expect(next).toBe('2026-04-25T02:30:00.000Z');
  });
});
