import { getAdminAuth, getAdminDb } from './firebaseAdmin.js';
import { isAdminEmail } from '../lib/adminEmails.js';

export async function verifyFirebaseToken(token: string) {
  const auth = getAdminAuth();
  return auth.verifyIdToken(token);
}

export async function getUserPlan(uid: string): Promise<string> {
  const db = getAdminDb();
  const doc = await db.collection('users').doc(uid).get();
  return (doc.data()?.plan as string | undefined)?.toLowerCase() || 'free';
}

export async function verifyAiAccess(token: string) {
  const decoded = await verifyFirebaseToken(token);
  const email = decoded.email?.toLowerCase();
  const isAdmin = decoded.superAdmin === true || isAdminEmail(email);

  if (isAdmin) return { decoded, plan: 'pro' as const };

  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const userData = userDoc.data();
  const plan = (userData?.plan as string | undefined)?.toLowerCase() || 'free';

  if (plan === 'pro') return { decoded, plan: 'pro' as const };

  const needsOnboarding =
    !userData?.onboardingCompletedAt && !String(userData?.resumeText || '').trim();
  if (needsOnboarding) return { decoded, plan: 'free' as const };

  throw Object.assign(new Error('Pro plan required for AI features.'), { status: 403 });
}
