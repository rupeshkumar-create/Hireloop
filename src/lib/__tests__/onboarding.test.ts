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
  it('is true after onboarding until the first pipeline save', () => {
    expect(isInFirstSession(baseProfile, 0)).toBe(true);
  });

  it('is false after the user saves a job', () => {
    expect(isInFirstSession(baseProfile, 1)).toBe(false);
  });

  it('is false when first session was marked complete', () => {
    expect(
      isInFirstSession({ ...baseProfile, firstSessionCompletedAt: new Date().toISOString() }, 0)
    ).toBe(false);
  });
});

describe('shouldUseCompactFreePaywall', () => {
  it('uses compact paywall for free users in first session', () => {
    expect(shouldUseCompactFreePaywall(baseProfile, 'free', 0)).toBe(true);
  });

  it('does not use compact paywall for pro users', () => {
    expect(shouldUseCompactFreePaywall(baseProfile, 'pro', 0)).toBe(false);
  });
});
