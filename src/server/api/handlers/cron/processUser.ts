/**
 * /api/cron/process-user — per-user job generation pipeline (Supabase-backed).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireInternalCronSecret } from '../../../cronAuth.js';
import { processUserCronRun } from '../../../../services/cronEngine.js';
import { computeNextJobDeliveryAt } from '../../../../services/jobDeliveryProfile.js';
import { discoverJobsForMatching } from '../../../../services/discoverJobs.js';
import { jobFingerprint } from '../../../../services/jobResearcher.js';
import { matchAndRankJobs } from '../../../../services/jobMatchingEngine.js';
import { createOpenRouterCaller } from '../../../../services/openRouterCaller.js';
import type { DailyJob } from '../../../../types/dailyJob.js';
import { stripUndefinedDeep } from '../../../../lib/firestoreSanitizer.js';
import { getDiscoveryPoolTarget } from '../../../../lib/planLimits.js';
import { PIPELINE_MIN_MATCH_SCORE } from '../../../../lib/matchQuality.js';
import { resolveOrderedCareerPaths, priorityCareerPaths } from '../../../../lib/careerPaths.js';
import { resolveTargetMarkets } from '../../../../lib/targetMarkets.js';
import { getProfile, upsertProfile } from '../../../db/profiles.js';
import { getCronRun, setCronRun } from '../../../db/cronRuns.js';
import { setDailyMatch } from '../../../db/dailyMatches.js';

const MAX_SEEN_FINGERPRINTS = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireInternalCronSecret(req, res)) return;

  const { userId, runDate } = req.body || {};
  if (!userId || !runDate) {
    return res.status(400).json({ error: 'Missing userId or runDate' });
  }

  try {
    const result = await processUserCronRun(
      { userId, runDate },
      {
        loadUser: async (uid) => {
          const profile = await getProfile(uid);
          return profile ? { id: uid, data: profile as Record<string, unknown> } : null;
        },

        getExistingRun: async (runId) => {
          const run = await getCronRun(runId);
          return run.exists ? ({ id: runId, ...run.data } as Record<string, unknown>) : null;
        },

        markRun: async (runId, patch) => {
          await setCronRun(runId, { userId, runDate, dispatchSource: 'daily-alerts-v2', ...patch });
        },

        generateJobs: async (profile, limit) => {
          const careerPaths = resolveOrderedCareerPaths(profile);
          const priorityPaths = priorityCareerPaths(profile);
          const targetMarkets = resolveTargetMarkets(profile);
          const resumeText: string = profile.resumeText || '';
          const jobType: string = profile.jobType || 'remote';
          const location: string = profile.location || '';
          const seenFingerprints: string[] = profile.seenJobFingerprints || [];

          const targetCount = getDiscoveryPoolTarget(profile.plan);
          const { jobs: discovered, sources } = await discoverJobsForMatching({
            careerPaths: priorityPaths.length > 0 ? priorityPaths : careerPaths,
            resumeText,
            jobType,
            location,
            targetCount,
            seenFingerprints,
            targetMarkets,
            structuredProfile: profile.structuredProfile,
            deliveryTimezone: profile.deliveryTimezone,
            preferences: profile.matchingPreferences || profile.preferences,
          });

          console.log(`[process-user] ${userId}: discovered ${discovered.length} jobs`, sources);

          if (discovered.length === 0) {
            return {
              jobs: [],
              requestedLimit: limit,
              usedBackfill: false,
              totalValidatedJobs: 0,
              unseenCount: 0,
              seenCount: 0,
              qualityFilteredCount: 0,
              dedupedCount: 0,
            };
          }

          const matchResult = await matchAndRankJobs(
            discovered,
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
            createOpenRouterCaller(),
          );

          const qualityFilteredCount =
            'qualityFilteredCount' in matchResult && typeof matchResult.qualityFilteredCount === 'number'
              ? matchResult.qualityFilteredCount
              : 0;
          const dedupedCount =
            'dedupedCount' in matchResult && typeof matchResult.dedupedCount === 'number'
              ? matchResult.dedupedCount
              : 0;

          return {
            jobs: matchResult.jobs,
            requestedLimit: limit,
            usedBackfill: matchResult.usedFallback,
            totalValidatedJobs: matchResult.scoredCount,
            unseenCount: matchResult.scoredCount,
            seenCount: 0,
            qualityFilteredCount,
            dedupedCount,
          };
        },

        storeJobs: async (uid, date, profile, generated) => {
          const fetchedAt = new Date().toISOString();
          const jobs: DailyJob[] = generated.jobs || [];
          const deliveryTimezone = profile.deliveryTimezone || 'UTC';
          const preferredDeliveryHour = profile.preferredDeliveryHour ?? 8;
          const requestedLimit = generated.requestedLimit ?? jobs.length;
          const qualityFilteredCount = generated.qualityFilteredCount ?? 0;
          const dedupedCount = generated.dedupedCount ?? 0;
          const qualityLimited = jobs.length < requestedLimit;
          const warnings = profile.matchReadiness?.qualityWarnings || [];

          const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
          const nextFingerprints = [
            ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
          ].slice(-MAX_SEEN_FINGERPRINTS);

          await upsertProfile(
            uid,
            stripUndefinedDeep({
              dailyJobs: jobs,
              dailyJobsMeta: {
                requestedLimit,
                returnedCount: jobs.length,
                qualityFilteredCount,
                dedupedCount,
                deliveryTimezone,
                deliveryLocalDate: date,
                qualityLimited,
                warnings,
              },
              lastJobFetchTime: fetchedAt,
              ...(jobs.length > 0 ? { lastSuccessfulJobRunLocalDate: date } : {}),
              nextJobDeliveryAt:
                jobs.length > 0
                  ? computeNextJobDeliveryAt(deliveryTimezone, preferredDeliveryHour, new Date(fetchedAt))
                  : profile.nextJobDeliveryAt,
              matchReadiness: profile.matchReadiness,
              seenJobFingerprints: nextFingerprints,
            }) as Record<string, unknown>,
          );

          const sources: Record<string, number> = {};
          for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

          await setDailyMatch(uid, date, jobs, stripUndefinedDeep({
            userId: uid,
            date,
            generatedAt: fetchedAt,
            jobCount: jobs.length,
            sources,
            requestedLimit,
            returnedCount: jobs.length,
            qualityFilteredCount,
            dedupedCount,
            deliveryTimezone,
            deliveryLocalDate: date,
            qualityLimited,
            warnings,
          }) as Record<string, unknown>);
        },
      },
    );

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[process-user] ${userId} failed:`, message);
    return res.status(500).json({ error: message });
  }
}
