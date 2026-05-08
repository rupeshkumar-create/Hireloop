import { normalizeUserPreferences, type NormalizedUserPreferences } from './validator.js';

export interface DeliverySettingsInput {
  deliveryTimezone?: string;
  preferredDeliveryHour?: unknown;
}

export interface MatchReadiness {
  status: 'ready' | 'partial' | 'blocked';
  hasResume: boolean;
  hasCareerPaths: boolean;
  blockingReason: string | null;
  qualityWarnings: string[];
}

export interface DueDailyRunResult {
  due: boolean;
  localDate: string;
  localHour: number;
  nextDeliveryAt: string;
  reason?: 'NOT_DUE_YET' | 'ALREADY_COMPLETED';
}

export function normalizeDeliverySettings(input: DeliverySettingsInput): {
  deliveryTimezone: string;
  preferredDeliveryHour: number;
} {
  const deliveryTimezone = (input.deliveryTimezone || '').trim() || 'UTC';
  const parsedHour =
    typeof input.preferredDeliveryHour === 'number'
      ? input.preferredDeliveryHour
      : typeof input.preferredDeliveryHour === 'string'
        ? Number.parseInt(input.preferredDeliveryHour, 10)
        : 8;

  const preferredDeliveryHour =
    Number.isFinite(parsedHour) && parsedHour >= 0 && parsedHour <= 23
      ? parsedHour
      : 8;

  return { deliveryTimezone, preferredDeliveryHour };
}

export function buildMatchingPreferences(profile: {
  matchingPreferences?: NormalizedUserPreferences;
  preferences?: unknown;
  jobType?: string;
  minSalary?: number | null;
  location?: string;
}): NormalizedUserPreferences {
  if (profile.matchingPreferences) return profile.matchingPreferences;

  return normalizeUserPreferences(
    profile.preferences || {
      remoteOnly: profile.jobType === 'remote',
      salaryFloor: profile.minSalary,
      locations: profile.location ? [profile.location] : [],
    }
  );
}

export function computeMatchReadiness(profile: {
  resumeText?: string;
  careerPaths?: string[];
}): MatchReadiness {
  const resumeText = (profile.resumeText || '').trim();
  const careerPaths = Array.isArray(profile.careerPaths)
    ? profile.careerPaths.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];

  const hasResume = resumeText.length >= 50;
  const hasCareerPaths = careerPaths.length > 0;

  if (!hasResume && !hasCareerPaths) {
    return {
      status: 'blocked',
      hasResume,
      hasCareerPaths,
      blockingReason: 'Profile missing usable resume text and career paths.',
      qualityWarnings: [],
    };
  }

  if (!hasResume && hasCareerPaths) {
    return {
      status: 'partial',
      hasResume,
      hasCareerPaths,
      blockingReason: null,
      qualityWarnings: ['Resume text is missing or too short; matching quality may be limited.'],
    };
  }

  return {
    status: 'ready',
    hasResume,
    hasCareerPaths,
    blockingReason: null,
    qualityWarnings: [],
  };
}

function getLocalParts(timeZone: string, now: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: Number.parseInt(get('year') || '0', 10),
    month: Number.parseInt(get('month') || '0', 10),
    day: Number.parseInt(get('day') || '0', 10),
    hour: Number.parseInt(get('hour') || '0', 10),
    minute: Number.parseInt(get('minute') || '0', 10),
    second: Number.parseInt(get('second') || '0', 10),
  };
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const local = getLocalParts(timeZone, date);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    0
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
  const offsetMs = getTimeZoneOffsetMs(timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offsetMs);
}

export function computeNextJobDeliveryAt(
  deliveryTimezone: string,
  preferredDeliveryHour: number,
  now: Date = new Date()
): string {
  const local = getLocalParts(deliveryTimezone, now);
  let target = zonedDateTimeToUtc(
    deliveryTimezone,
    local.year,
    local.month,
    local.day,
    preferredDeliveryHour
  );

  if (target.getTime() <= now.getTime()) {
    const nextLocal = getLocalParts(
      deliveryTimezone,
      new Date(target.getTime() + 36 * 60 * 60 * 1000)
    );
    target = zonedDateTimeToUtc(
      deliveryTimezone,
      nextLocal.year,
      nextLocal.month,
      nextLocal.day,
      preferredDeliveryHour
    );
  }

  return target.toISOString();
}

export function evaluateDueDailyRun(
  profile: DeliverySettingsInput & { lastSuccessfulJobRunLocalDate?: string },
  now: Date = new Date()
): DueDailyRunResult {
  const { deliveryTimezone, preferredDeliveryHour } = normalizeDeliverySettings(profile);
  const local = getLocalParts(deliveryTimezone, now);
  const localDate = [
    String(local.year).padStart(4, '0'),
    String(local.month).padStart(2, '0'),
    String(local.day).padStart(2, '0'),
  ].join('-');
  const nextDeliveryAt = computeNextJobDeliveryAt(deliveryTimezone, preferredDeliveryHour, now);

  if (profile.lastSuccessfulJobRunLocalDate === localDate) {
    return {
      due: false,
      localDate,
      localHour: local.hour,
      nextDeliveryAt,
      reason: 'ALREADY_COMPLETED',
    };
  }

  if (local.hour < preferredDeliveryHour) {
    return {
      due: false,
      localDate,
      localHour: local.hour,
      nextDeliveryAt,
      reason: 'NOT_DUE_YET',
    };
  }

  return { due: true, localDate, localHour: local.hour, nextDeliveryAt };
}
