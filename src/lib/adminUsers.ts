import type { ScoutLearningContext } from '../services/learningSignals';

export type AdminUserListItem = {
  id: string;
  email?: string;
  displayName?: string;
  plan?: 'free' | 'pro';
  createdAt?: unknown;
  lastActiveAt?: unknown;
  jobType?: string;
  location?: string;
  minSalary?: number | null;
  careerPaths?: string[];
};

export type AdminUserDetail = AdminUserListItem & {
  learningProfile?: {
    jobPreferences?: string;
    writingStyle?: string;
  };
  resumeText?: string;
  seenJobFingerprints?: string[];
  learningSignals?: ScoutLearningContext;
};

type RawAdminUserRecord = {
  id: string;
  email?: unknown;
  displayName?: unknown;
  plan?: unknown;
  createdAt?: unknown;
  lastActiveAt?: unknown;
  jobType?: unknown;
  location?: unknown;
  minSalary?: unknown;
  careerPaths?: unknown;
  learningProfile?: unknown;
  resumeText?: unknown;
  seenJobFingerprints?: unknown;
  learningSignals?: unknown;
};

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

  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

function toLearningProfile(value: unknown): AdminUserDetail['learningProfile'] | undefined {
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

export function buildAdminUserListItem(user: RawAdminUserRecord): AdminUserListItem {
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

export function buildAdminUserDetail(user: RawAdminUserRecord): AdminUserDetail {
  return {
    ...buildAdminUserListItem(user),
    learningProfile: toLearningProfile(user.learningProfile),
    resumeText: toOptionalString(user.resumeText),
    seenJobFingerprints: toStringArray(user.seenJobFingerprints),
    learningSignals:
      user.learningSignals && typeof user.learningSignals === 'object'
        ? (user.learningSignals as ScoutLearningContext)
        : undefined,
  };
}
