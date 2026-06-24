/**
 * Super Admin — Users API (Supabase-backed)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../../supabaseAdmin.js';
import { getBearerToken, verifySuperAdmin } from '../../../adminAuth.js';
import { getProfile, listProfiles, upsertProfile, deleteProfile } from '../../../db/profiles.js';
import { deleteTrackedJobsForUser } from '../../../db/trackedJobs.js';

function getSortableTime(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function normalizeDateLike(value: unknown): unknown {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
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
  return v.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
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

function toPreferences(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (typeof p.remoteOnly === 'boolean') result.remoteOnly = p.remoteOnly;
  if (typeof p.salaryFloor === 'number') result.salaryFloor = p.salaryFloor;
  if (p.salaryFloor === null) result.salaryFloor = null;
  if (Array.isArray(p.locations)) result.locations = p.locations.filter((l) => typeof l === 'string');
  return Object.keys(result).length ? result : undefined;
}

function buildDetail(u: RawUser) {
  const lp = u.learningProfile;
  const learningProfile =
    lp && typeof lp === 'object'
      ? {
          jobPreferences: toOptionalString((lp as Record<string, unknown>).jobPreferences),
          writingStyle: toOptionalString((lp as Record<string, unknown>).writingStyle),
        }
      : undefined;

  return {
    ...buildListItem(u),
    learningProfile,
    preferences: toPreferences(u.preferences),
    matchingPreferences: toPreferences(u.matchingPreferences),
    resumeText: toOptionalString(u.resumeText),
    seenJobFingerprints: toStringArray(u.seenJobFingerprints),
    learningSignals: u.learningSignals && typeof u.learningSignals === 'object' ? u.learningSignals : undefined,
  };
}

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function getLimit(v: unknown): number {
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, MAX_LIMIT);
  }
  return DEFAULT_LIMIT;
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

  if (userId) {
    const profile = await getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ user: buildDetail({ id: userId, ...profile } as RawUser) });
  }

  const limit = getLimit(req.query.limit);
  const rows = await listProfiles(limit);
  const users = rows
    .map((r) => buildListItem({ id: r.id, ...r.data } as RawUser))
    .sort((a, b) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt));

  return res.status(200).json({
    users,
    meta: { count: users.length, limit, truncated: rows.length >= limit },
  });
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  if (!userId) return res.status(400).json({ error: 'Missing userId query param.' });

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

  const existing = await getProfile(userId);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  await upsertProfile(userId, patch);

  return res.status(200).json({ ok: true, updated: patch });
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  if (!userId) return res.status(400).json({ error: 'Missing userId query param.' });

  try {
    await getSupabaseAdmin().auth.admin.deleteUser(userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes('not found')) throw err;
  }

  await deleteProfile(userId);
  await deleteTrackedJobsForUser(userId);

  return res.status(200).json({ ok: true, deleted: userId });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

    await verifySuperAdmin(token);

    switch (req.method) {
      case 'GET': return await handleGet(req, res);
      case 'PATCH': return await handlePatch(req, res);
      case 'DELETE': return await handleDelete(req, res);
      default: return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (status >= 500) console.error('[Admin API Error]', err);
    return res.status(status).json({ error: message });
  }
}
