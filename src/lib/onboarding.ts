import type { UserProfile } from '../contexts/AuthContext';
import { isProPlan } from './planLimits';

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
  if (!profile?.dailyJobs?.length) {
    // Scout may finish with zero matches — still let users reach the final step.
    if (
      profile.lastJobFetchTime ||
      profile.lastSuccessfulJobRunLocalDate ||
      profile.onboardingScoutStartedAt
    ) {
      return 'matches';
    }
    return 'scout';
  }
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
 * Guided first dashboard for Pro users — stays active until the user saves a match
 * to Pipeline or opens the full dashboard. Free users skip this guided view because
 * it references AI asset generation they cannot use without Pro.
 */
export function isInFirstSession(
  profile: UserProfile | null | undefined,
  pipelineSavedCount: number,
  plan?: string
): boolean {
  if (!isProPlan(plan || profile?.plan)) return false;
  if (!profile?.onboardingCompletedAt) return false;
  if (profile.firstSessionCompletedAt) return false;
  if (pipelineSavedCount > 0) return false;
  return true;
}

/** @deprecated Free users skip guided first session; full dashboard shows locked-match upsell. */
export function shouldUseCompactFreePaywall(
  _profile: UserProfile | null | undefined,
  _plan?: string,
  _pipelineSavedCount = 0
): boolean {
  return false;
}
