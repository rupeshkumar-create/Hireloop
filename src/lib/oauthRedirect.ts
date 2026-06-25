/** OAuth return URL — must match an entry in Supabase → Authentication → Redirect URLs. */
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
      // fall through to env
    }
  }

  const fromEnv = envSiteUrl?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  return windowOrigin || 'http://localhost:3001';
}

export function getOAuthRedirectUrl(): string {
  const origin = resolveOAuthOrigin(
    typeof window !== 'undefined' ? window.location.origin : undefined,
    import.meta.env.VITE_SITE_URL
  );
  return `${origin}/login`;
}
