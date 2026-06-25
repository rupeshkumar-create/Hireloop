import { verifySupabaseToken } from './supabaseAuth.js';
import { getProfile } from './db/profiles.js';

export async function verifyAuthToken(token: string) {
  return verifySupabaseToken(token);
}

/** @deprecated Use verifyAuthToken */
export const verifyFirebaseToken = verifyAuthToken;

export async function getUserPlan(uid: string): Promise<string> {
  const profile = await getProfile(uid);
  return profile?.plan?.toLowerCase() || 'free';
}

export async function verifyAiAccess(token: string) {
  const decoded = await verifyAuthToken(token);
  let profile = null;
  try {
    profile = await getProfile(decoded.uid);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Profile lookup failed';
    console.error('[verifyAiAccess] getProfile failed:', message, decoded.uid);
  }
  const plan = profile?.plan?.toLowerCase() || 'free';
  return { decoded, plan: plan === 'pro' ? ('pro' as const) : ('free' as const) };
}
