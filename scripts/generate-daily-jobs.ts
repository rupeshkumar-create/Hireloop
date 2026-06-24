/**
 * scripts/generate-daily-jobs.ts — GitHub Actions daily pipeline (Supabase-backed).
 */
import './load-env.ts';
import { createOpenRouterCaller } from '../src/services/openRouterCaller';
import { discoverJobsForMatching } from '../src/services/discoverJobs';
import { jobFingerprint } from '../src/services/jobResearcher';
import { matchAndRankJobs } from '../src/services/jobMatchingEngine';
import { evaluateDueUsers, isActiveCronUser, processUserCronRun } from '../src/services/cronEngine';
import type { DailyJob } from '../src/types/dailyJob';
import { formatLocalDate } from '../src/lib/localDate';
import { stripUndefinedDeep } from '../src/lib/firestoreSanitizer';
import { getDiscoveryPoolTarget } from '../src/lib/planLimits';
import { resolveOrderedCareerPaths, priorityCareerPaths } from '../src/lib/careerPaths';
import { resolveTargetMarkets } from '../src/lib/targetMarkets';
import { PIPELINE_MIN_MATCH_SCORE } from '../src/lib/matchQuality';
import { getProfile, upsertProfile, listProfilesPaginated } from '../src/server/db/profiles';
import { getCronRun, setCronRun } from '../src/server/db/cronRuns';
import { setDailyMatch } from '../src/server/db/dailyMatches';

const MAX_SEEN_FINGERPRINTS = 500;
const USER_PAGE_SIZE = 200;
const callOpenRouter = createOpenRouterCaller();

function resolveCareerPaths(profile: Record<string, unknown>): string[] {
  return resolveOrderedCareerPaths(profile as Parameters<typeof resolveOrderedCareerPaths>[0]);
}

async function processUser(userId: string, runDate: string, force = false) {
  return processUserCronRun(
    { userId, runDate, bypassActiveCheck: force },
    {
      loadUser: async (uid) => {
        const profile = await getProfile(uid);
        return profile ? { id: uid, data: profile as Record<string, unknown> } : null;
      },
      getExistingRun: async (runId) => {
        if (force) return null;
        const run = await getCronRun(runId);
        return run.exists ? ({ id: runId, ...run.data } as Record<string, unknown>) : null;
      },
      markRun: async (runId, patch) => {
        await setCronRun(runId, { userId, runDate, dispatchSource: 'github-actions', ...patch });
      },
      generateJobs: async (profile, limit) => {
        const careerPaths = resolveCareerPaths(profile);
        const priorityPaths = priorityCareerPaths(profile);
        const targetMarkets = resolveTargetMarkets(profile);
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'remote';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];
        const targetDiscoveryCount = getDiscoveryPoolTarget(profile.plan);

        const { jobs: combined } = await discoverJobsForMatching({
          careerPaths: priorityPaths.length > 0 ? priorityPaths : careerPaths,
          resumeText,
          jobType,
          location,
          targetCount: targetDiscoveryCount,
          seenFingerprints,
          targetMarkets,
          structuredProfile: profile.structuredProfile,
          deliveryTimezone: profile.deliveryTimezone,
          preferences: profile.matchingPreferences || profile.preferences,
        });

        const matchResult = await matchAndRankJobs(
          combined,
          {
            careerPaths,
            priorityCareerPaths: priorityPaths,
            resumeText,
            jobType,
            seenFingerprints,
            limit,
            minMatchScore: PIPELINE_MIN_MATCH_SCORE,
            matchingPreferences: profile.matchingPreferences || profile.preferences,
            deliveryTimezone: profile.deliveryTimezone,
            structuredProfile: profile.structuredProfile,
            targetMarkets,
          },
          callOpenRouter,
        );

        return {
          jobs: matchResult.jobs,
          requestedLimit: limit,
          usedBackfill: matchResult.usedFallback,
          totalValidatedJobs: matchResult.scoredCount,
          unseenCount: matchResult.scoredCount,
          seenCount: 0,
          qualityFilteredCount: matchResult.qualityFilteredCount,
          dedupedCount: matchResult.dedupedCount,
        };
      },
      storeJobs: async (uid, date, profile, generated) => {
        const fetchedAt = new Date().toISOString();
        const jobs: DailyJob[] = generated.jobs || [];
        const requestedLimit = generated.requestedLimit ?? jobs.length;
        const deliveryTimezone = profile.deliveryTimezone || 'UTC';
        const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
        const nextFingerprints = [
          ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
        ].slice(-MAX_SEEN_FINGERPRINTS);

        await upsertProfile(
          uid,
          stripUndefinedDeep({
            dailyJobs: jobs,
            lastJobFetchTime: fetchedAt,
            ...(jobs.length > 0 ? { lastSuccessfulJobRunLocalDate: date } : {}),
            seenJobFingerprints: nextFingerprints,
            dailyJobsMeta: {
              requestedLimit,
              returnedCount: jobs.length,
              qualityFilteredCount: generated.qualityFilteredCount ?? 0,
              dedupedCount: generated.dedupedCount ?? 0,
              deliveryTimezone,
              deliveryLocalDate: date,
              qualityLimited: jobs.length < requestedLimit,
            },
          }) as Record<string, unknown>,
        );

        const sources: Record<string, number> = {};
        for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

        await setDailyMatch(
          uid,
          date,
          jobs,
          stripUndefinedDeep({
            userId: uid,
            date,
            generatedAt: fetchedAt,
            jobCount: jobs.length,
            sources,
            requestedLimit,
            returnedCount: jobs.length,
            deliveryTimezone,
            deliveryLocalDate: date,
            qualityLimited: jobs.length < requestedLimit,
          }) as Record<string, unknown>,
        );
      },
    },
  );
}

async function main() {
  const now = new Date();
  const specificUserId = process.env.USER_ID?.trim();
  const forceRerun = Boolean(specificUserId) || process.env.FORCE_RERUN === 'true';

  if (specificUserId) {
    console.log(`[generate-daily-jobs] Single-user mode: ${specificUserId} (force=${forceRerun})`);
    const profile = (await getProfile(specificUserId)) || {};
    const runDate = formatLocalDate(now, profile.deliveryTimezone || 'UTC');
    const result = await processUser(specificUserId, runDate, forceRerun);
    console.log('[generate-daily-jobs] Done:', result);
    return;
  }

  console.log('[generate-daily-jobs] Cron run — loading active users');
  const activeUsers: { id: string; data: Record<string, unknown> }[] = [];
  let offset = 0;

  for (;;) {
    const page = await listProfilesPaginated(USER_PAGE_SIZE, offset);
    if (page.length === 0) break;
    for (const user of page) {
      if (isActiveCronUser(user.data)) activeUsers.push(user);
    }
    offset += page.length;
    if (page.length < USER_PAGE_SIZE) break;
  }

  const { due, skipped } = evaluateDueUsers(activeUsers);
  console.log(`[generate-daily-jobs] ${activeUsers.length} active users, ${due.length} due, ${skipped.length} skipped`);

  let processed = 0;
  let failed = 0;

  for (const user of due) {
    const runDate =
      (user.data.deliveryLocalDate as string) ||
      formatLocalDate(now, (user.data.deliveryTimezone as string) || 'UTC');
    console.log(`[${user.id}] processing (runDate=${runDate})…`);
    try {
      await processUser(user.id, runDate);
      processed++;
    } catch (err) {
      console.error(`[${user.id}] failed:`, err);
      failed++;
    }
  }

  console.log(`[generate-daily-jobs] Done — processed: ${processed}, failed: ${failed}, skipped: ${skipped.length}`);
}

main().catch((err) => {
  console.error('[generate-daily-jobs] Fatal:', err);
  process.exit(1);
});
