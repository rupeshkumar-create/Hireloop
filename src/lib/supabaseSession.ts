import { getSupabaseBrowserClient } from './supabaseClient';

const REFRESH_BUFFER_MS = 120_000;

/**
 * Returns a valid Supabase access token for server API calls.
 * Refreshes the session when missing, expired, or near expiry.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();

  const readSessionToken = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) return null;
    return data.session.access_token;
  };

  const refreshToken = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) return null;
    return data.session.access_token;
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!session?.access_token) {
    return refreshToken();
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const nearExpiry = !expiresAtMs || expiresAtMs < Date.now() + REFRESH_BUFFER_MS;
  if (nearExpiry) {
    const refreshed = await refreshToken();
    if (refreshed) return refreshed;
  }

  const { error: userError } = await supabase.auth.getUser();
  if (userError) {
    const refreshed = await refreshToken();
    if (refreshed) return refreshed;
    return readSessionToken();
  }

  return session.access_token;
}

export async function forceRefreshAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) return null;
  return data.session.access_token;
}
