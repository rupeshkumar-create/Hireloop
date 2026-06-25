/**
 * OAuth return URL — must match Supabase → Authentication → Redirect URLs.
 * Always uses the current browser origin so a mis-set VITE_SITE_URL cannot
 * send production users to localhost.
 */
export function getOAuthRedirectUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/login`;
  }

  const fromEnv = import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, '');
  return `${fromEnv || 'http://localhost:3001'}/login`;
}

/** @deprecated use getOAuthRedirectUrl — kept for tests */
export function resolveOAuthOrigin(
  windowOrigin: string | undefined,
  envSiteUrl: string | undefined
): string {
  if (windowOrigin) {
    try {
      const { hostname, origin } = new URL(windowOrigin);
      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local');
      if (!isLocal) return origin;
    } catch {
      // fall through
    }
  }
  const fromEnv = envSiteUrl?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return windowOrigin || 'http://localhost:3001';
}
