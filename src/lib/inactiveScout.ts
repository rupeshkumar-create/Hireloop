import { isRecentlyActiveUser, type CronEligibleUser } from '../services/cronEngine';

export interface InactiveScoutProfile extends CronEligibleUser {
  inactiveScoutPromptShownAt?: string;
}

/** Manual Scout CTA — only for users inactive 3+ days, once per inactivity spell. */
export function shouldShowInactiveScoutCta(
  profile: InactiveScoutProfile | null | undefined,
  now: Date = new Date()
): boolean {
  if (!profile) return false;
  if (isRecentlyActiveUser(profile, now)) return false;

  const shownAt = profile.inactiveScoutPromptShownAt;
  if (!shownAt) return true;

  const lastActiveMs = profile.lastActiveAt ?? profile.createdAt;
  if (!lastActiveMs) return false;

  // User was active again after we showed the prompt → new inactivity spell.
  return new Date(lastActiveMs).getTime() > new Date(shownAt).getTime();
}

export function shouldHideManualScoutControls(
  profile: InactiveScoutProfile | null | undefined,
  now: Date = new Date()
): boolean {
  return isRecentlyActiveUser(profile ?? {}, now);
}
