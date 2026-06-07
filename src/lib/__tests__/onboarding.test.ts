import { describe, expect, it } from 'vitest';
import { isInFirstSession, shouldUseCompactFreePaywall } from '../onboarding';
import type { UserProfile } from '../../contexts/AuthContext';

const baseProfile: UserProfile = {
  uid: 'u1',
  email: 'test@example.com',
  createdAt: new Date().toISOString(),
  onboardingCompletedAt: new Date().toISOString(),
};

describe('isInFirstSession', () => {
  it('is true for Pro users after onboarding until the first pipeline save', () => {
    expect(isInFirstSession(baseProfile, 0, 'pro')).toBe(true);
  });

  it('is false for free users — they skip the guided first dashboard', () => {
    expect(isInFirstSession(baseProfile, 0, 'free')).toBe(false);
  });

  it('is false after the user saves a job', () => {
    expect(isInFirstSession(baseProfile, 1, 'pro')).toBe(false);
  });

  it('is false when first session was marked complete', () => {
    expect(
      isInFirstSession({ ...baseProfile, firstSessionCompletedAt: new Date().toISOString() }, 0, 'pro')
    ).toBe(false);
  });
});

describe('shouldUseCompactFreePaywall', () => {
  it('is always false — free users use the full dashboard upsell', () => {
    expect(shouldUseCompactFreePaywall(baseProfile, 'free', 0)).toBe(false);
    expect(shouldUseCompactFreePaywall(baseProfile, 'pro', 0)).toBe(false);
  });
});
