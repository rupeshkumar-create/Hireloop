import type { User } from '@supabase/supabase-js';
import { normalizeLinkedInProfileUrl } from './linkedinUrl';

export type OAuthProvider = 'google' | 'linkedin_oidc' | 'email' | string;

export function getOAuthProvider(user: User | null | undefined): OAuthProvider | null {
  if (!user) return null;
  const fromApp = user.app_metadata?.provider;
  if (typeof fromApp === 'string' && fromApp) return fromApp;
  const identity = user.identities?.[0];
  if (identity?.provider) return identity.provider;
  return null;
}

export function signedInWithLinkedIn(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.app_metadata?.providers?.includes('linkedin_oidc')) return true;
  return user.identities?.some((i) => i.provider === 'linkedin_oidc') ?? false;
}

/** Best-effort LinkedIn /in/ URL from Supabase user + identity metadata. */
export function extractLinkedInProfileUrlFromUser(user: User | null | undefined): string | null {
  if (!user) return null;

  const blobs: Record<string, unknown>[] = [
    user.user_metadata ?? {},
    ...(user.identities ?? [])
      .filter((i) => i.provider === 'linkedin_oidc')
      .map((i) => (i.identity_data ?? {}) as Record<string, unknown>),
  ];

  const candidates: string[] = [];
  for (const data of blobs) {
    for (const key of [
      'profile',
      'profile_url',
      'profileUrl',
      'linkedin',
      'linkedin_url',
      'linkedinUrl',
      'url',
      'website',
    ]) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
    }
    for (const key of ['preferred_username', 'vanityName', 'vanity', 'slug', 'username', 'provider_id', 'sub']) {
      const value = data[key];
      if (typeof value === 'string' && value.trim() && !value.includes('@')) {
        const slug = value.trim();
        // LinkedIn OIDC sub is often the public handle (e.g. jTItE-xtg3)
        if (!slug.startsWith('http')) {
          candidates.push(`https://linkedin.com/in/${slug}`);
        } else {
          candidates.push(slug);
        }
      }
    }
  }

  for (const raw of candidates) {
    const normalized = normalizeLinkedInProfileUrl(raw);
    if (normalized) return normalized;
  }

  return null;
}

/** Minimal resume text from OAuth claims when Apify / profile URL is unavailable. */
export function buildResumeTextFromOAuthUser(user: User | null | undefined): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const lines: string[] = [];
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    user.email?.split('@')[0] ||
    '';
  const headline =
    (typeof meta.headline === 'string' && meta.headline) ||
    (typeof meta.job_title === 'string' && meta.job_title) ||
    '';
  const location = typeof meta.location === 'string' ? meta.location : '';

  if (name) lines.push(name);
  if (headline) lines.push(headline);
  if (location) lines.push(`Location: ${location}`);
  if (user.email) lines.push(`Email: ${user.email}`);

  const linkedin = extractLinkedInProfileUrlFromUser(user);
  if (linkedin) lines.push(`LinkedIn: ${linkedin}`);

  return lines.join('\n').trim();
}
