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

// Only select the fields required for the table to prevent payload/memory explosion
const LIST_FIELDS = [
  'email',
  'displayName',
  'plan',
  'createdAt',
  'lastActiveAt',
  'jobType',
  'location',
  'minSalary',
  'careerPaths',
] as const;

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toOptionalNumber(value: unknown): number | null | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return value === null ? null : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
  return items.length ? items : [];
}

function normalizeDateLike(value: unknown): unknown {
  if (!value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toISOString();
    } catch {
      return undefined;
    }
  }

  return value;
}

function toLearningProfile(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const profile = value as Record<string, unknown>;
  const normalized = {
    jobPreferences: toOptionalString(profile.jobPreferences),
    writingStyle: toOptionalString(profile.writingStyle),
  };

  return normalized.jobPreferences || normalized.writingStyle ? normalized : undefined;
}

function buildAdminUserListItem(user: AdminUserRecord) {
  return {
    id: user.id,
    email: toOptionalString(user.email),
    displayName: toOptionalString(user.displayName),
    plan: user.plan === 'pro' ? 'pro' : 'free',
    createdAt: normalizeDateLike(user.createdAt),
    lastActiveAt: normalizeDateLike(user.lastActiveAt),
    jobType: toOptionalString(user.jobType),
    location: toOptionalString(user.location),
    minSalary: toOptionalNumber(user.minSalary),
    careerPaths: toStringArray(user.careerPaths),
  };
}

function buildAdminUserDetail(user: AdminUserRecord) {
  return {
    ...buildAdminUserListItem(user),
    learningProfile: toLearningProfile(user.learningProfile),
    resumeText: toOptionalString(user.resumeText),
    seenJobFingerprints: toStringArray(user.seenJobFingerprints),
    learningSignals:
      user.learningSignals && typeof user.learningSignals === 'object'
        ? user.learningSignals
        : undefined,
  };
}

/**
 * Top-level error boundary to catch Vercel function initialization or runtime errors
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing admin token' });
    }

    let auth;
    let db;

    try {
      auth = getAdminAuth();
      db = getAdminDb();
    } catch (initError: any) {
      console.error('[Admin Endpoint Init Failed]', initError);
      return res.status(500).json({ error: `Backend initialization failed: ${initError.message}` });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(token);
    } catch (tokenError: any) {
      console.error('[Admin Token Verification Failed]', tokenError);
      return res.status(401).json({ error: `Invalid admin token: ${tokenError.message}` });
    }

    if (!isAllowedAdminEmail(decoded.email)) {
      return res.status(403).json({ error: 'Not authorized as super admin' });
    }

    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

    if (requestedUserId) {
      try {
        const docSnapshot = await db.collection('users').doc(requestedUserId).get();
        
        if (!docSnapshot.exists) {
          return res.status(404).json({ error: 'User not found' });
        }

        const user = buildAdminUserDetail({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as AdminUserRecord);

        return res.status(200).json({ user });
      } catch (dbError: any) {
        console.error(`[Admin Detail Query Failed] user: ${requestedUserId}`, dbError);
        return res.status(500).json({ error: `Failed to load user details: ${dbError.message}` });
      }
    }

    try {
      const snapshot = await db.collection('users').select(...LIST_FIELDS).get();
      const users = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as AdminUserRecord)
        .sort((a, b) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt))
        .map(buildAdminUserListItem);

      return res.status(200).json({ users });
    } catch (listError: any) {
      console.error('[Admin List Query Failed]', listError);
      return res.status(500).json({ error: `Failed to fetch users list: ${listError.message}` });
    }

  } catch (uncaughtError: any) {
    console.error('[Fatal Admin Endpoint Error]', uncaughtError);
    const message = uncaughtError instanceof Error ? uncaughtError.message : String(uncaughtError);
    return res.status(500).json({ error: `A critical server error occurred: ${message}` });
  }
}
