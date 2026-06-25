/** OAuth return URL — must match an entry in Supabase → Authentication → Redirect URLs. */
export function getOAuthRedirectUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  const origin = fromEnv?.replace(/\/$/, '') || window.location.origin;
  return `${origin}/login`;
}
