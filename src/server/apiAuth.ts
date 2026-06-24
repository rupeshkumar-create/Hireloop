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
  const profile = await getProfile(decoded.uid);
  const plan = profile?.plan?.toLowerCase() || 'free';
  return { decoded, plan: plan === 'pro' ? ('pro' as const) : ('free' as const) };
}
