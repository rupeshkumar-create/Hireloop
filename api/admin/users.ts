import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../_lib/firebaseAdmin';

const SUPER_ADMIN_EMAILS = [
  'rupesh7126@gmail.com',
  'kv3244@gmail.com',
  'rupesh7128@gmail.com',
];

function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}

function getSortableTime(value: unknown): number {
  if (!value) return 0;

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    return ((value as { seconds: number }).seconds) * 1000;
  }

  return 0;
}

function isAllowedAdminEmail(email: string | null | undefined): boolean {
  return SUPER_ADMIN_EMAILS.includes((email || '').trim().toLowerCase());
}

type AdminUserRecord = {
  id: string;
  createdAt?: unknown;
} & Record<string, unknown>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing admin token' });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAllowedAdminEmail(decoded.email)) {
      return res.status(403).json({ error: 'Not authorized as super admin' });
    }

    const snapshot = await getAdminDb().collection('users').get();
    const users: AdminUserRecord[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as AdminUserRecord)
      .sort((a, b) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt));

    return res.status(200).json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
