import type { VercelRequest } from '@vercel/node';
import { getAdminAuth } from './firebaseAdmin.js';
import { isAdminEmail } from '../lib/adminEmails.js';

export function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export async function verifySuperAdmin(token: string) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(token);
  const userEmail = decoded.email?.toLowerCase();

  if (decoded.superAdmin !== true && !isAdminEmail(userEmail)) {
    throw Object.assign(new Error('Not authorized as super admin.'), { status: 403 });
  }
  return decoded;
}
