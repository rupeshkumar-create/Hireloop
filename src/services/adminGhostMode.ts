import { getDailyMatchLimit } from '../lib/planLimits';
import { jobFingerprint } from './jobResearcher';
import type {
  DailyJobsDebugResult,
  GhostModeInputMode,
  GhostModeOverrides,
  GhostModeProfileInput,
  GhostModeRunMode,
  GhostModeRunResult,
  GhostModeTargetUser,
} from '../types/adminGhostMode';
import type { DailyJob } from '../types/dailyJob';

const MAX_SEEN_FINGERPRINTS = 500;

export function buildGhostModeProfileInput(
  targetUser: GhostModeTargetUser,
  inputMode: GhostModeInputMode,
  overrides?: GhostModeOverrides
): GhostModeProfileInput {
  const base: GhostModeProfileInput = {
    plan: targetUser.plan,
    email: targetUser.email,
    careerPaths: targetUser.careerPaths || [],
    jobType: targetUser.jobType || 'both',
    minSalary: targetUser.minSalary || null,
    resumeText: targetUser.resumeText || '',
    location: targetUser.location || '',
    seenFingerprints: targetUser.seenJobFingerprints || [],
    learningContext: targetUser.learningProfile?.jobPreferences || '',
    learningSignals: targetUser.learningSignals,
  };

  if (inputMode === 'saved' || !overrides) return base;

  return {
    ...base,
    careerPaths: overrides.careerPaths ?? base.careerPaths,
    jobType: overrides.jobType ?? base.jobType,
    minSalary: overrides.minSalary !== undefined ? overrides.minSalary : base.minSalary,
    resumeText: overrides.resumeText ?? base.resumeText,
    location: overrides.location ?? base.location,
    learningContext: overrides.learningContext ?? base.learningContext,
    learningSignals: overrides.learningSignals ?? base.learningSignals,
  };
}

export function assertGhostModeProfileReady(profile: GhostModeProfileInput) {
  if (!profile.careerPaths.length) {
    throw new Error('Career paths are required before running Ghost Mode.');
  }
  if (!profile.resumeText.trim()) {
    throw new Error('Resume text is required before running Ghost Mode.');
  }
}

interface RunAdminGhostModeRequest {
  targetUser: GhostModeTargetUser;
  admin: { uid: string; email: string };
  runMode: GhostModeRunMode;
  inputMode: GhostModeInputMode;
  overrides?: GhostModeOverrides;
}

interface RunAdminGhostModeDeps {
  generateDebugResult: (
    input: GhostModeProfileInput & { limit: number }
  ) => Promise<DailyJobsDebugResult>;
  persistDailyJobs: (payload: {
    userId: string;
    jobs: DailyJob[];
    lastJobFetchTime: string;
    seenJobFingerprints: string[];
    runDate: string;
  }) => Promise<void>;
  logRun: (payload: Record<string, unknown>) => Promise<void>;
  now?: () => string;
}

export async function runAdminGhostMode(
  request: RunAdminGhostModeRequest,
  deps: RunAdminGhostModeDeps
): Promise<GhostModeRunResult> {
  const effectiveProfile = buildGhostModeProfileInput(
    request.targetUser,
    request.inputMode,
    request.overrides
  );
  assertGhostModeProfileReady(effectiveProfile);

  const requestedLimit = getDailyMatchLimit(effectiveProfile.plan);
  const debug = await deps.generateDebugResult({ ...effectiveProfile, limit: requestedLimit });

  const timestamp = deps.now ? deps.now() : new Date().toISOString();
  const runDate = timestamp.split('T')[0];

  if (request.runMode === 'persist') {
    const nextSeenFingerprints = [
      ...new Set([
        ...effectiveProfile.seenFingerprints,
        ...debug.finalJobs.map((job) => jobFingerprint(job.title, job.company)),
      ]),
    ].slice(-MAX_SEEN_FINGERPRINTS);

    await deps.persistDailyJobs({
      userId: request.targetUser.id,
      jobs: debug.finalJobs,
      lastJobFetchTime: timestamp,
      seenJobFingerprints: nextSeenFingerprints,
      runDate,
    });

    await deps.logRun({
      adminUid: request.admin.uid,
      adminEmail: request.admin.email,
      targetUserId: request.targetUser.id,
      targetUserEmail: request.targetUser.email || '',
      action: 'simulate_daily_jobs_v2',
      runMode: request.runMode,
      inputMode: request.inputMode,
      overrideKeys: Object.keys(request.overrides || {}).filter(
        (key) => request.overrides?.[key as keyof GhostModeOverrides] !== undefined
      ),
      finalCount: debug.finalJobs.length,
      scoredCount: debug.scoredCount,
      harvestedCount: debug.harvestedCount,
      timestamp,
    });
  }

  return { persisted: request.runMode === 'persist', requestedLimit, effectiveProfile, debug };
}
