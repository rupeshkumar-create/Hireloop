/**
 * Super Admin — Users API
 *
 * Auth: Firebase ID token (Authorization: Bearer <token>) with superAdmin custom claim.
 *
 * GET    /api/admin/users            → list users (up to limit)
 * GET    /api/admin/users?userId=xxx → get single user detail
 * PATCH  /api/admin/users?userId=xxx → update user fields (plan, jobType, location, minSalary, careerPaths)
 * DELETE /api/admin/users?userId=xxx → delete user from Firebase Auth + Firestore + trackedJobs
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../_lib/firebaseAdmin.js';

// ── Auth ────────────────────────────────────────────────────────────────────

function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

async function verifySuperAdmin(token: string) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(token);
  if (decoded.superAdmin !== true) {
    throw Object.assign(new Error('Not authorized as super admin.'), { status: 403 });
  }
  return decoded;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSortableTime(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return ((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

function normalizeDateLike(value: unknown): unknown {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try { return (value as { toDate: () => Date }).toDate().toISOString(); } catch { return undefined; }
  }
  return value;
}

function toOptionalString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function toOptionalNumber(v: unknown): number | null | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return v === null ? null : undefined;
}

function toStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const items = v.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
  return items;
}

type RawUser = { id: string } & Record<string, unknown>;

function buildListItem(u: RawUser) {
  return {
    id: u.id,
    email: toOptionalString(u.email),
    displayName: toOptionalString(u.displayName),
    plan: u.plan === 'pro' ? 'pro' : 'free',
    createdAt: normalizeDateLike(u.createdAt),
    lastActiveAt: normalizeDateLike(u.lastActiveAt),
    jobType: toOptionalString(u.jobType),
    location: toOptionalString(u.location),
    minSalary: toOptionalNumber(u.minSalary),
    careerPaths: toStringArray(u.careerPaths),
  };
}

function buildDetail(u: RawUser) {
  const lp = u.learningProfile;
  const learningProfile =
    lp && typeof lp === 'object'
      ? {
          jobPreferences: toOptionalString((lp as any).jobPreferences),
          writingStyle: toOptionalString((lp as any).writingStyle),
        }
      : undefined;

  return {
    ...buildListItem(u),
    learningProfile,
    resumeText: toOptionalString(u.resumeText),
    seenJobFingerprints: toStringArray(u.seenJobFingerprints),
    learningSignals: u.learningSignals && typeof u.learningSignals === 'object' ? u.learningSignals : undefined,
  };
}

const LIST_FIELDS = [
  'email', 'displayName', 'plan', 'createdAt', 'lastActiveAt',
  'jobType', 'location', 'minSalary', 'careerPaths',
] as const;

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function getLimit(v: unknown): number {
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, MAX_LIMIT);
  }
  return DEFAULT_LIMIT;
}

// ── Route Handlers ───────────────────────────────────────────────────────────

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const db = getAdminDb();
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

  if (userId) {
    const snap = await db.collection('users').doc(userId).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ user: buildDetail({ id: snap.id, ...snap.data() } as RawUser) });
  }

  const limit = getLimit(req.query.limit);
  let snapshot: any;

  try {
    snapshot = await db.collection('users').orderBy('createdAt', 'desc').select(...LIST_FIELDS).limit(limit).get();
  } catch (err: any) {
    const msg: string = err?.message || '';
    if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')) {
      // Fallback: unordered query, sort in memory
      snapshot = await db.collection('users').select(...LIST_FIELDS).limit(limit).get();
    } else {
      throw err;
    }
  }

  const users = snapshot.docs
    .map((d: any) => buildListItem({ id: d.id, ...d.data() } as RawUser))
    .sort((a: any, b: any) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt));

  return res.status(200).json({
    users,
    meta: { count: users.length, limit, truncated: snapshot.size >= limit },
  });
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  if (!userId) return res.status(400).json({ error: 'Missing userId query param.' });

  const db = getAdminDb();
  const body = req.body || {};
  const patch: Record<string, unknown> = {};

  if (body.plan === 'pro' || body.plan === 'free') patch.plan = body.plan;
  if (typeof body.jobType === 'string') patch.jobType = body.jobType;
  if (typeof body.location === 'string') patch.location = body.location;
  if (body.minSalary === null || (typeof body.minSalary === 'number' && Number.isFinite(body.minSalary))) {
    patch.minSalary = body.minSalary;
  }
  if (Array.isArray(body.careerPaths)) {
    patch.careerPaths = body.careerPaths.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0);
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  patch.updatedAt = new Date().toISOString();

  const docRef = db.collection('users').doc(userId);
  const snap = await docRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'User not found.' });

  await docRef.set(patch, { merge: true });

  return res.status(200).json({ ok: true, updated: patch });
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  if (!userId) return res.status(400).json({ error: 'Missing userId query param.' });

  const auth = getAdminAuth();
  const db = getAdminDb();

  // 1. Delete from Firebase Auth (ignore if already gone)
  try {
    await auth.deleteUser(userId);
  } catch (err: any) {
    if (err.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  // 2. Delete Firestore user document
  await db.collection('users').doc(userId).delete();

  // 3. Delete tracked jobs (batch, up to 200)
  const trackedSnap = await db.collection('trackedJobs').where('userId', '==', userId).limit(200).get();
  if (!trackedSnap.empty) {
    const batch = db.batch();
    trackedSnap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  return res.status(200).json({ ok: true, deleted: userId });
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

    await verifySuperAdmin(token);

    switch (req.method) {
      case 'GET':    return await handleGet(req, res);
      case 'PATCH':  return await handlePatch(req, res);
      case 'DELETE': return await handleDelete(req, res);
      default:       return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err: any) {
    const status = err.status ?? 500;
    const message = err.message || 'Internal server error';
    if (status >= 500) console.error('[Admin API Error]', err);
    return res.status(status).json({ error: message });
  }
}
