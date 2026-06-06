import { describe, expect, it } from 'vitest';
import {
  deriveOnboardingStep,
  isFreshlyOnboarded,
  isOnboardingComplete,
  nextStepAfterUpload,
} from '../onboarding';

describe('isOnboardingComplete', () => {
  it('returns false for empty profile', () => {
    expect(isOnboardingComplete(null)).toBe(false);
    expect(isOnboardingComplete(undefined)).toBe(false);
  });

  it('returns true when onboardingCompletedAt is set', () => {
    expect(isOnboardingComplete({ onboardingCompletedAt: '2026-01-01' } as any)).toBe(true);
  });

  it('returns true for legacy accounts with resume, paths, and daily jobs', () => {
    expect(
      isOnboardingComplete({
        resumeText: 'Engineer',
        careerPaths: ['Software Engineer'],
        dailyJobs: [{ title: 'Dev' }],
      } as any)
    ).toBe(true);
  });

  it('returns false when resume exists but wizard is incomplete', () => {
    expect(
      isOnboardingComplete({
        resumeText: 'Engineer',
        careerPaths: ['Software Engineer'],
      } as any)
    ).toBe(false);
  });
});

describe('deriveOnboardingStep', () => {
  it('starts at upload without a resume', () => {
    expect(deriveOnboardingStep(null)).toBe('upload');
  });

  it('moves to paths after resume upload', () => {
    expect(deriveOnboardingStep({ resumeText: 'Engineer' } as any)).toBe('paths');
  });

  it('moves to scout when paths exist but no jobs yet', () => {
    expect(
      deriveOnboardingStep({
        resumeText: 'Engineer',
        careerPaths: ['Software Engineer'],
      } as any)
    ).toBe('scout');
  });

  it('shows matches preview when jobs exist', () => {
    expect(
      deriveOnboardingStep({
        resumeText: 'Engineer',
        careerPaths: ['Software Engineer'],
        dailyJobs: [{ title: 'Dev' }],
      } as any)
    ).toBe('matches');
  });
});

describe('nextStepAfterUpload', () => {
  it('skips paths when career paths were auto-detected', () => {
    expect(
      nextStepAfterUpload({
        resumeText: 'Engineer',
        careerPaths: ['Frontend Engineer'],
      } as any)
    ).toBe('scout');
  });

  it('goes to paths when none were detected', () => {
    expect(nextStepAfterUpload({ resumeText: 'Engineer' } as any)).toBe('paths');
  });
});

describe('isFreshlyOnboarded', () => {
  it('returns true within the freshness window', () => {
    expect(
      isFreshlyOnboarded({ onboardingCompletedAt: new Date().toISOString() } as any)
    ).toBe(true);
  });
});
