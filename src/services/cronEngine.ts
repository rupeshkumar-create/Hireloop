import { getDailyMatchLimit } from '../lib/planLimits.js';
import { computeMatchReadiness, evaluateDueDailyRun } from './jobDeliveryProfile.js';

export interface CronEligibleUser {
  plan?: string;
  receiveDailyAlerts?: boolean;
  deliveryTimezone?: string;
  preferredDeliveryHour?: number;
  nextJobDeliveryAt?: string;
  lastSuccessfulJobRunLocalDate?: string;
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

export function evaluateDueUsers(
  users: LoadedCronUser[],
  now: Date = new Date()
) {
  const due: LoadedCronUser[] = [];
  const skipped: LoadedCronUser[] = [];

  for (const user of users) {
    if (!isActiveCronUser(user.data)) {
      skipped.push(user);
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

  return { due, skipped };
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
