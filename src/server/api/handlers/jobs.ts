import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySupabaseToken } from '../../supabaseAuth.js';
import { getProfile, upsertProfile } from '../../db/profiles.js';
import { getDailyMatch } from '../../db/dailyMatches.js';
import { setDailyMatch } from '../../db/dailyMatches.js';
import { setCronRun, getCronRun } from '../../db/cronRuns.js';
import { processUserCronRun } from '../../../services/cronEngine.js';
import { computeMatchReadiness } from '../../../services/jobDeliveryProfile.js';
import { discoverJobsForMatching } from '../../../services/discoverJobs.js';
import { jobFingerprint, type DiscoveredJob } from '../../../services/jobResearcher.js';
import { matchAndRankJobs } from '../../../services/jobMatchingEngine.js';
import { createOpenRouterCaller } from '../../../services/openRouterCaller.js';
import type { DailyJob } from '../../../types/dailyJob.js';
import { formatLocalDate } from '../../../lib/localDate.js';
import { stripUndefinedDeep } from '../../../lib/firestoreSanitizer.js';
import { evaluateScoutDedup } from '../../scoutDedup.js';
import { getDiscoveryPoolTarget } from '../../../lib/planLimits.js';
import { PIPELINE_MIN_MATCH_SCORE } from '../../../lib/matchQuality.js';
import { resolveOrderedCareerPaths, priorityCareerPaths } from '../../../lib/careerPaths.js';
import { resolveTargetMarkets } from '../../../lib/targetMarkets.js';

const MAX_SEEN_FINGERPRINTS = 500;

function resolveCareerPaths(profile: Record<string, any>): string[] {
  return resolveOrderedCareerPaths(profile);
}

function isLocalRequest(req: VercelRequest): boolean {
  return Boolean(
    req.headers.host?.includes('localhost') ||
    req.headers.host?.includes('127.0.0.1')
  );
}

async function verifyUser(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) return null;

  const decoded = await verifySupabaseToken(idToken);
  return decoded.uid;
}

type JobPipelineResult = {
  status: 'completed' | 'failed' | 'skipped';
  jobs: DailyJob[];
  debug: Record<string, unknown>;
};

type PipelineOptions = Record<string, never>;

async function runPipeline(
  uid: string,
  runDate: string,
  _req: VercelRequest,
  _options: PipelineOptions = {}
): Promise<JobPipelineResult> {
  let storedJobs: DailyJob[] = [];
  let debug: Record<string, unknown> = {};

  const result = await processUserCronRun(
    { userId: uid, runDate, bypassActiveCheck: true },
    {
      loadUser: async (userId) => {
        const profile = await getProfile(userId);
        return profile ? { id: userId, data: profile as Record<string, unknown> } : null;
      },
      getExistingRun: async (_runId) => null,
      markRun: async (runId, patch) => {
        await setCronRun(runId, { userId: uid, runDate, dispatchSource: 'user-triggered', ...patch });
      },
      generateJobs: async (profile, limit) => {
        console.log('[api/jobs] Starting generateJobs for user:', uid);
        const careerPaths = resolveCareerPaths(profile);
        const priorityPaths = priorityCareerPaths(profile);
        const targetMarkets = resolveTargetMarkets(profile);
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'remote';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];
        let discovered: DiscoveredJob[] = [];
        try {
          const targetCount = getDiscoveryPoolTarget(profile.plan);
          const { jobs: feedJobs, sources } = await discoverJobsForMatching({
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
          discovered = feedJobs;
          console.log('[api/jobs] discoverJobsForMatching returned:', feedJobs.length, sources);
          debug = {
            ...debug,
            careerPaths,
            jobType,
            hasResumeText: resumeText.trim().length > 0,
            apifyJobCount: feedJobs.length,
            targetDiscoveryCount: targetCount,
            discoverySources: sources,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[api/jobs] discoverJobsForMatching failed:', message);
          debug = {
            ...debug,
            careerPaths,
            emptyReason: `Job discovery failed: ${message}`,
          };
          return {
            jobs: [],
            requestedLimit: limit,
            usedBackfill: false,
            totalValidatedJobs: 0,
            unseenCount: 0,
            seenCount: 0,
          };
        }

        if (discovered.length === 0) {
          debug = {
            ...debug,
            matchedCount: 0,
            emptyReason: 'No jobs discovered from Apify.',
          };
          return {
            jobs: [],
            requestedLimit: limit,
            usedBackfill: false,
            totalValidatedJobs: 0,
            unseenCount: 0,
            seenCount: 0,
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
          createOpenRouterCaller()
        );

        debug = {
          ...debug,
          discoveredCount: discovered.length,
          matchedCount: matchResult.jobs.length,
          scoredCount: matchResult.scoredCount,
          usedFallback: matchResult.usedFallback,
          qualityFilteredCount: matchResult.qualityFilteredCount,
          dedupedCount: matchResult.dedupedCount,
          emptyReason:
            matchResult.jobs.length === 0
              ? 'Jobs were discovered but no jobs survived matching.'
              : undefined,
        };

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
      storeJobs: async (userId, date, profile, generated) => {
        const fetchedAt = new Date().toISOString();
        const jobs: DailyJob[] = generated.jobs || [];
        storedJobs = jobs;
        const requestedLimit = generated.requestedLimit ?? jobs.length;
        const qualityFilteredCount = generated.qualityFilteredCount ?? 0;
        const dedupedCount = generated.dedupedCount ?? 0;
        const deliveryTimezone = profile.deliveryTimezone || 'UTC';
        const qualityLimited = jobs.length < requestedLimit;
        const warnings = profile.matchReadiness?.qualityWarnings || [];

        const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
        const nextFingerprints = [
          ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
        ].slice(-MAX_SEEN_FINGERPRINTS);

        const userPatch: Record<string, unknown> = {
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
            matchReadiness: profile.matchReadiness,
            seenJobFingerprints: nextFingerprints,
          };
        if (jobs.length > 0) {
          userPatch.lastSuccessfulJobRunLocalDate = date;
        }

        await upsertProfile(userId, stripUndefinedDeep(userPatch) as Record<string, unknown>);

        const sources: Record<string, number> = {};
        for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

        await setDailyMatch(
          userId,
          date,
          jobs,
          stripUndefinedDeep({
            userId,
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
          }) as Record<string, unknown>
        );
      },
    }
  );

  if (result.status !== 'completed') {
    const run = await getCronRun(`${uid}_${runDate}`).catch(() => ({ exists: false, data: null }));
    const failureReason = run.data?.failureReason;
    return {
      status: result.status,
      jobs: storedJobs,
      debug: {
        ...debug,
        failureReason,
      },
    };
  }

  return { status: 'completed', jobs: storedJobs, debug };
}

async function readStoredJobs(uid: string, runDate: string): Promise<DailyJob[]> {
  const match = await getDailyMatch(uid, runDate);
  if (match?.jobs?.length) return match.jobs;

  const profile = await getProfile(uid);
  return profile?.dailyJobs || [];
}

function wantsForceRerun(req: VercelRequest): boolean {
  return req.body?.force === true;
}

async function handleAsyncDispatch(uid: string, req: VercelRequest, res: VercelResponse) {
  const profile = await getProfile(uid);
  if (!profile) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const careerPaths = resolveCareerPaths(profile as Record<string, unknown>);
  const runDate = formatLocalDate(new Date(), profile.deliveryTimezone || 'UTC');
  const force = wantsForceRerun(req);

  const dedup = evaluateScoutDedup(profile);
  if (dedup.blocked && !force) {
    const jobs = await readStoredJobs(uid, runDate);
    return res.status(409).json({
      error: 'Scout has already found your matches for today.',
      status: 'already_generated',
      runDate,
      jobCount: jobs.length,
      planCap: dedup.planCap,
      jobs,
    });
  }

  const readiness = computeMatchReadiness({ resumeText: profile.resumeText, careerPaths });
  if (readiness.status === 'blocked') {
    return res.status(400).json({
      error: 'Add at least one career path or upload your resume before generating jobs.',
    });
  }

  const isLocal = isLocalRequest(req);
  const firstRun = req.body?.firstRun === true || !profile.lastSuccessfulJobRunLocalDate;

  if (!isLocal) {
    console.log('[api/jobs] Dispatching Scout in background', { firstRun, force, runDate });
    const pipelinePromise = runPipeline(uid, runDate, req).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api/jobs] Background Scout pipeline failed:', message);
    });

    try {
      const vercelFunctions = await import('@vercel/functions');
      if (typeof vercelFunctions.waitUntil === 'function') {
        vercelFunctions.waitUntil(pipelinePromise);
      } else {
        void pipelinePromise;
      }
    } catch {
      void pipelinePromise;
    }

    return res.status(202).json({
      status: 'processing',
      runDate,
      firstRun,
      message:
        'Searching live job boards for your top matches. Your dashboard will update automatically in about 2 minutes.',
    });
  }

  const pipelineResult = await runPipeline(uid, runDate, req);
  const jobs = pipelineResult.jobs.length > 0 ? pipelineResult.jobs : await readStoredJobs(uid, runDate);
  if (pipelineResult.status === 'skipped') {
    const failureReason =
      (pipelineResult.debug as Record<string, unknown>)?.failureReason ||
      'Profile is not ready for Scout.';
    return res.status(400).json({
      error: String(failureReason),
      status: pipelineResult.status,
      debug: pipelineResult.debug,
    });
  }
  if (pipelineResult.status !== 'completed') {
    const failureReason = (pipelineResult.debug as any)?.failureReason || (pipelineResult.debug as any)?.emptyReason;
    return res.status(500).json({
      error: failureReason || 'Daily job generation did not complete.',
      status: pipelineResult.status,
      debug: pipelineResult.debug,
    });
  }

  return res.status(200).json({
    status: 'completed',
    runDate,
    jobs,
    jobCount: jobs.length,
    message: jobs.length > 0
      ? `${jobs.length} jobs curated for you.`
      : 'No matching jobs were found for today. Try broadening your career paths or work preferences.',
  });
}

async function handleSyncTrigger(uid: string, req: VercelRequest, res: VercelResponse) {
  const profile = (await getProfile(uid)) || {};
  const runDate = formatLocalDate(new Date(), profile.deliveryTimezone || 'UTC');

  const dedup = evaluateScoutDedup(profile);
  if (dedup.blocked) {
    const jobs = await readStoredJobs(uid, runDate);
    return res.status(409).json({
      error: 'Scout has already found your matches for today.',
      status: 'already_generated',
      jobs,
      planCap: dedup.planCap,
    });
  }

  const pipelineResult = await runPipeline(uid, runDate, req);
  const jobs = pipelineResult.jobs.length > 0 ? pipelineResult.jobs : await readStoredJobs(uid, runDate);
  const isLocal = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1');
  return res.status(200).json({
    jobs,
    ...(isLocal ? { debug: pipelineResult.debug, status: pipelineResult.status } : {}),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[api/jobs] Received ${req.method} request`);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid: string | null = null;
  try {
    uid = await verifyUser(req);
    console.log('[api/jobs] User verified:', uid);
    if (!uid) return res.status(401).json({ error: 'Missing Authorization header' });
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || String(error);
    console.error('[api/jobs] Auth failed:', code, message);

    // Surface diagnostics — Supabase JWT verification failures are usually:
    //   - missing SUPABASE_URL / service role key
    //   - expired access token (client should refresh)
    return res.status(401).json({
      error: 'Authentication failed.',
      code: code || undefined,
      detail: message,
    });
  }

  const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : 'request';
  console.log('[api/jobs] Mode:', mode);

  try {
    if (mode === 'request') return await handleAsyncDispatch(uid, req, res);
    if (mode === 'trigger') return await handleSyncTrigger(uid, req, res);
    return res.status(400).json({ error: 'Invalid jobs mode. Use "request" or "trigger".' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[jobs/index] Unexpected failure:', message);
    return res.status(500).json({ error: message });
  }
}
