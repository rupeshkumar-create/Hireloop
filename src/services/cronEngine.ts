import { getDailyMatchLimit } from '../lib/planLimits.js';
import { computeMatchReadiness, evaluateDueDailyRun } from './jobDeliveryProfile.js';

/**
 * Inactivity window for the daily-alerts cron.
 *
 * The 8 AM IST daily run is the single most expensive thing in the system
 * (job research + AI ranking per user). If a user hasn't opened the app for
 * this many full days, we stop burning that budget on them and auto-pause
 * their daily run until they explicitly click "Resume daily alerts".
 *
 * 3 means: active today and the next 3 calendar days the run still fires;
 * on the 4th day with no activity, the run is skipped and the profile is
 * flagged with `dailyAlertsAutoPaused: true`.
 */
export const INACTIVITY_PAUSE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DailyAlertsPausedReason = 'inactive_3_days';

export interface CronEligibleUser {
  plan?: string;
  receiveDailyAlerts?: boolean;
  deliveryTimezone?: string;
  preferredDeliveryHour?: number;
  nextJobDeliveryAt?: string;
  lastSuccessfulJobRunLocalDate?: string;
  /** Last time the user opened the app — set by AuthContext (1h throttle). */
  lastActiveAt?: string;
  /** Sentinel: created so the daily-alerts query orderBy includes the doc. */
  createdAt?: string;
  /** True when the cron has auto-paused this user's daily run for inactivity. */
  dailyAlertsAutoPaused?: boolean;
  dailyAlertsPausedReason?: DailyAlertsPausedReason | null;
  dailyAlertsPausedAt?: string | null;
}

export interface CronRunRecord {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  failureReason?: string;
}

export interface LoadedCronUser {
  id: string;
  data: Record<string, any>;
}

export interface ProcessUserCronRunInput {
  userId: string;
  runDate: string;
  /** Skip the isActiveCronUser check — use for user-triggered on-demand runs */
  bypassActiveCheck?: boolean;
}

export interface ProcessUserCronRunDeps {
  loadUser: (userId: string) => Promise<LoadedCronUser | null>;
  getExistingRun: (runId: string) => Promise<CronRunRecord | null>;
  markRun: (runId: string, patch: Record<string, unknown>) => Promise<void>;
  generateJobs: (profile: Record<string, any>, limit: number) => Promise<{
    jobs: any[];
    requestedLimit?: number;
    qualityFilteredCount?: number;
    dedupedCount?: number;
  }>;
  storeJobs: (
    userId: string,
    runDate: string,
    profile: Record<string, any>,
    result: {
      jobs: any[];
      requestedLimit?: number;
      qualityFilteredCount?: number;
      dedupedCount?: number;
    }
  ) => Promise<void>;
}

export interface QueueCronRunInput {
  userId: string;
  runDate: string;
  plan: string;
  email?: string;
}

export function isActiveCronUser(user: CronEligibleUser): boolean {
  return Boolean(user.plan) && user.receiveDailyAlerts !== false;
}

export type InactivitySkipReason =
  | 'auto_paused' // already auto-paused; waiting for manual resume
  | 'inactive_3_days'; // crossed the inactivity window during this run

export interface InactivityBlocked {
  reason: InactivitySkipReason;
  /** Whether the dispatcher should write `dailyAlertsAutoPaused: true`. */
  shouldPersistPause: boolean;
  daysInactive: number;
}

/**
 * `null` means the user is active and the cron should run.
 * Any non-null value describes how/why the cron should skip them.
 *
 * Returning `null` for the happy path (instead of a discriminated union)
 * sidesteps a TS narrowing edge case and keeps call sites short:
 * `const blocked = evaluateActivityGate(user); if (blocked) { ... }`
 */
export type ActivityGate = InactivityBlocked | null;

/**
 * Decide whether the daily-alerts cron should spend its (expensive) job
 * pipeline budget on this user.
 *
 * Rules:
 *   1. If the user is already auto-paused, stay paused — only a manual
 *      "Resume daily alerts" click flips the flag back.
 *   2. If the user has no recorded activity at all, fall back to `createdAt`
 *      so brand-new accounts that signed up but haven't opened the dashboard
 *      again are treated by the same window.
 *   3. Otherwise compare full calendar-day deltas: a user active today gets
 *      runs today + the next 3 days; on day 4 (≥ 4 * 24h since their last
 *      activity) we mark them auto-paused.
 *
 * Treating "active today" generously (using > not >=) avoids edge cases
 * around midnight rollovers where a user who literally just used the app
 * 23h59m ago would otherwise be lumped into the "1 day inactive" bucket
 * incorrectly.
 */
export function evaluateActivityGate(
  user: CronEligibleUser,
  now: Date = new Date()
): ActivityGate {
  if (user.dailyAlertsAutoPaused === true) {
    return {
      reason: 'auto_paused',
      shouldPersistPause: false,
      daysInactive: -1,
    };
  }

  const referenceIso = user.lastActiveAt || user.createdAt;
  if (!referenceIso) {
    // No timestamps at all — be conservative and don't auto-pause yet.
    // The first 8 AM cron after sign-up will set lastJobFetchTime, and
    // AuthContext will start writing lastActiveAt on the next app open.
    return null;
  }

  const referenceMs = Date.parse(referenceIso);
  if (!Number.isFinite(referenceMs)) {
    return null;
  }

  const daysInactive = Math.floor((now.getTime() - referenceMs) / MS_PER_DAY);
  if (daysInactive > INACTIVITY_PAUSE_DAYS) {
    return {
      reason: 'inactive_3_days',
      shouldPersistPause: true,
      daysInactive,
    };
  }

  return null;
}

export function getCronRunDateIST(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to compute IST run date');
  }

  return `${year}-${month}-${day}`;
}

export function buildCronRunId(userId: string, runDate: string): string {
  return `${userId}_${runDate}`;
}

function resolveCareerPaths(profile: Record<string, any>): string[] {
  const fromCareerPaths = Array.isArray(profile.careerPaths)
    ? profile.careerPaths
    : [];
  const fromStructuredRoles = Array.isArray(profile.structuredProfile?.roles)
    ? profile.structuredProfile.roles
    : [];

  return [...new Set([...fromCareerPaths, ...fromStructuredRoles])]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function queueCronRun(
  input: QueueCronRunInput,
  deps: {
    createRun: (run: QueueCronRunInput & { runId: string }) => Promise<boolean>;
  }
) {
  const runId = buildCronRunId(input.userId, input.runDate);
  const created = await deps.createRun({ ...input, runId });

  return {
    runId,
    status: created ? ('queued' as const) : ('duplicate' as const),
  };
}

export interface InactiveCronUser extends LoadedCronUser {
  inactivity: InactivityBlocked;
}

export function evaluateDueUsers(
  users: LoadedCronUser[],
  now: Date = new Date()
) {
  const due: LoadedCronUser[] = [];
  const skipped: LoadedCronUser[] = [];
  /**
   * Users blocked specifically by the inactivity gate — the dispatcher
   * uses this bucket to (a) flip `dailyAlertsAutoPaused: true` on the
   * profile and (b) write a `skipped` cronRuns record for observability,
   * without ever firing the expensive per-user pipeline.
   */
  const inactive: InactiveCronUser[] = [];

  for (const user of users) {
    if (!isActiveCronUser(user.data)) {
      skipped.push(user);
      continue;
    }

    const blocked = evaluateActivityGate(user.data, now);
    if (blocked) {
      inactive.push({ ...user, inactivity: blocked });
      continue;
    }

    if (user.data.nextJobDeliveryAt && user.data.nextJobDeliveryAt > now.toISOString()) {
      skipped.push(user);
      continue;
    }

    const dueResult = evaluateDueDailyRun(user.data, now);
    if (dueResult.due) {
      due.push({
        ...user,
        data: {
          ...user.data,
          deliveryLocalDate: dueResult.localDate,
          nextJobDeliveryAt: dueResult.nextDeliveryAt,
        },
      });
    } else {
      skipped.push(user);
    }
  }

  return { due, skipped, inactive };
}

export async function processUserCronRun(
  input: ProcessUserCronRunInput,
  deps: ProcessUserCronRunDeps
) {
  const runId = buildCronRunId(input.userId, input.runDate);
  const existingRun = await deps.getExistingRun(runId);

  if (existingRun?.status === 'completed' || existingRun?.status === 'processing') {
    return { runId, status: 'skipped' as const };
  }

  const loadedUser = await deps.loadUser(input.userId);
  if (!loadedUser || (!input.bypassActiveCheck && !isActiveCronUser(loadedUser.data))) {
    await deps.markRun(runId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
      failureReason: loadedUser ? 'Inactive or missing user' : 'User not found',
    });
    return { runId, status: 'skipped' as const };
  }

  // Inactivity gate — refuse to spend the (expensive) pipeline budget on
  // users who haven't opened the app in INACTIVITY_PAUSE_DAYS+ days, or who
  // are already auto-paused awaiting a manual "Resume daily alerts" click.
  // `bypassActiveCheck: true` (user-triggered runs from the dashboard)
  // intentionally skips this — that click IS the manual resume signal.
  if (!input.bypassActiveCheck) {
    const blocked = evaluateActivityGate(loadedUser.data);
    if (blocked) {
      await deps.markRun(runId, {
        status: 'skipped',
        completedAt: new Date().toISOString(),
        failureReason:
          blocked.reason === 'auto_paused'
            ? 'Daily alerts auto-paused — awaiting manual resume.'
            : `User inactive for ${blocked.daysInactive} day(s); auto-pausing daily alerts.`,
        inactivityReason: blocked.reason,
      });
      return { runId, status: 'skipped' as const };
    }
  }

  const profile = loadedUser.data;
  const effectiveCareerPaths = resolveCareerPaths(profile);
  const readiness = computeMatchReadiness({
    ...profile,
    careerPaths: effectiveCareerPaths,
  });
  const hasResumeText =
    typeof profile.resumeText === 'string' && profile.resumeText.trim().length > 0;

  if (readiness.status === 'blocked') {
    await deps.markRun(runId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
      failureReason: readiness.blockingReason || 'Profile is not ready for matching',
    });
    return { runId, status: 'skipped' as const };
  }

  if (!hasResumeText && effectiveCareerPaths.length === 0) {
    await deps.markRun(runId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
      failureReason: 'Profile missing resume text and career paths',
    });
    return { runId, status: 'skipped' as const };
  }

  const effectiveProfile = {
    ...profile,
    careerPaths: effectiveCareerPaths.length > 0 ? effectiveCareerPaths : profile.careerPaths || [],
    matchReadiness: readiness,
  };

  if (!profile.resumeText || profile.resumeText.trim().length < 50) {
    console.warn(
      `[cronEngine] ${input.userId}: resumeText is missing or too short — ` +
      'AI relevance will be limited to career paths and structured profile only.'
    );
  }

  await deps.markRun(runId, {
    status: 'processing',
    startedAt: new Date().toISOString(),
  });

  try {
    const limit = getDailyMatchLimit(profile.plan);
    const result = await deps.generateJobs(effectiveProfile, limit);
    await deps.storeJobs(input.userId, input.runDate, effectiveProfile, result);

    await deps.markRun(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      jobsStored: result.jobs.length,
      failureReason: null,
    });

    return { runId, status: 'completed' as const };
  } catch (error) {
    await deps.markRun(runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      failureReason: error instanceof Error ? error.message : String(error),
    });
    return { runId, status: 'failed' as const };
  }
}
