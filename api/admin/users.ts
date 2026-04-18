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
const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 1000;

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

function getListLimit(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, MAX_LIST_LIMIT);
    }
  }

  return DEFAULT_LIST_LIMIT;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
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

    const timeoutMs = 8000;

    let auth: ReturnType<typeof getAdminAuth>;
    try {
      auth = getAdminAuth();
    } catch (initError: any) {
      console.error('[Admin Auth Init Failed]', initError);
      return res.status(500).json({ error: `Backend initialization failed: ${initError.message}` });
    }

    let decoded;
    try {
      decoded = await withTimeout(auth.verifyIdToken(token), timeoutMs, 'Admin token verification');
    } catch (tokenError: any) {
      console.error('[Admin Token Verification Failed]', tokenError);
      return res.status(401).json({ error: `Invalid admin token: ${tokenError.message}` });
    }

    if (!isAllowedAdminEmail(decoded.email)) {
      return res.status(403).json({ error: 'Not authorized as super admin' });
    }

    let db: ReturnType<typeof getAdminDb>;
    try {
      db = getAdminDb();
    } catch (dbInitError: any) {
      console.error('[Admin Firestore Init Failed]', dbInitError);
      return res.status(500).json({ error: `Backend initialization failed: ${dbInitError.message}` });
    }

    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

    if (requestedUserId) {
      try {
        const docSnapshot = await withTimeout(
          db.collection('users').doc(requestedUserId).get(),
          timeoutMs,
          'Admin user detail query'
        );
        
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
      const limit = getListLimit(req.query.limit);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let snapshot: any;
      try {
        // Prefer ordered query so the limit captures the most recent users.
        // Falls back to unordered if the index is missing.
        snapshot = await withTimeout(
          db.collection('users').orderBy('createdAt', 'desc').select(...LIST_FIELDS).limit(limit).get(),
          timeoutMs,
          'Admin users list query (ordered)'
        );
      } catch (orderedError: any) {
        const msg: string = orderedError?.message || '';
        const isIndexError =
          msg.includes('requires an index') ||
          msg.includes('FAILED_PRECONDITION') ||
          msg.includes('index');
        if (!isIndexError) throw orderedError;
        console.warn('[Admin List] orderBy index missing, falling back to unordered query', msg);
        snapshot = await withTimeout(
          db.collection('users').select(...LIST_FIELDS).limit(limit).get(),
          timeoutMs,
          'Admin users list query (unordered fallback)'
        );
      }

      const users = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }) as AdminUserRecord)
        .map(buildAdminUserListItem)
        .sort((a, b) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt));

      return res.status(200).json({
        users,
        meta: {
          limit,
          count: users.length,
          truncated: snapshot.size >= limit,
        },
      });
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
