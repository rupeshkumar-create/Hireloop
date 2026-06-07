import type { UserProfile } from '../contexts/AuthContext';

export type OnboardingStep = 'upload' | 'paths' | 'scout' | 'matches';

/** True when the user finished the wizard or is a pre-wizard legacy account. */
export function isOnboardingComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.onboardingCompletedAt) return true;

  return (
    !!profile.resumeText &&
    (profile.careerPaths?.length || 0) > 0 &&
    (profile.dailyJobs?.length || 0) > 0
  );
}

/** Resume where the user should re-enter the wizard after refresh. */
export function deriveOnboardingStep(profile: UserProfile | null | undefined): OnboardingStep {
  if (!profile?.resumeText?.trim()) return 'upload';
  if (!profile?.careerPaths?.length) return 'paths';
  if (!profile?.dailyJobs?.length) return 'scout';
  return 'matches';
}

/** Recently finished onboarding — hide redundant checklist steps. */
export function isFreshlyOnboarded(
  profile: UserProfile | null | undefined,
  withinMs = 2 * 60 * 60 * 1000
): boolean {
  if (!profile?.onboardingCompletedAt) return false;
  const completedAt = new Date(profile.onboardingCompletedAt).getTime();
  return !Number.isNaN(completedAt) && Date.now() - completedAt < withinMs;
}

export function nextStepAfterUpload(profile: UserProfile | null | undefined): OnboardingStep {
  if ((profile?.careerPaths?.length || 0) > 0) return 'scout';
  return 'paths';
}

/**
 * Guided first dashboard — stays active until the user saves a match to Pipeline
 * or explicitly skips the guided view. Avoids dumping new users into the full
 * dashboard + nine locked cards before they understand the product loop.
 */
export function isInFirstSession(
  profile: UserProfile | null | undefined,
  pipelineSavedCount: number
): boolean {
  if (!profile?.onboardingCompletedAt) return false;
  if (profile.firstSessionCompletedAt) return false;
  if (pipelineSavedCount > 0) return false;
  return true;
}

/** Free users in first session see a single upsell strip instead of nine locked cards. */
export function shouldUseCompactFreePaywall(
  profile: UserProfile | null | undefined,
  plan?: string,
  pipelineSavedCount = 0
): boolean {
  if ((plan || profile?.plan || 'free').toLowerCase() === 'pro') return false;
  return isInFirstSession(profile, pipelineSavedCount);
}
