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
