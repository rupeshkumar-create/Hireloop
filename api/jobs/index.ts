import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
import { processUserCronRun } from '../../src/services/cronEngine.js';
import { computeMatchReadiness } from '../../src/services/jobDeliveryProfile.js';
import { discoverJobsForMatching } from '../../src/services/discoverJobs.js';
import { jobFingerprint, type DiscoveredJob } from '../../src/services/jobResearcher.js';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine.js';
import { createOpenRouterCaller } from '../../src/services/openRouterCaller.js';
import type { DailyJob } from '../../src/types/dailyJob.js';
import { formatLocalDate } from '../../src/lib/localDate.js';
import { stripUndefinedDeep } from '../../src/lib/firestoreSanitizer.js';
import { evaluateScoutDedup } from '../../src/server/scoutDedup.js';
import { getDiscoveryPoolTarget } from '../../src/lib/planLimits.js';
import { PIPELINE_MIN_MATCH_SCORE } from '../../src/lib/matchQuality.js';
import { resolveOrderedCareerPaths, priorityCareerPaths } from '../../src/lib/careerPaths.js';
import { resolveTargetMarkets } from '../../src/lib/targetMarkets.js';

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

  const decoded = await getAdminAuth().verifyIdToken(idToken);
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
  const db = getAdminDb();
  let storedJobs: DailyJob[] = [];
  let debug: Record<string, unknown> = {};

  const result = await processUserCronRun(
    { userId: uid, runDate, bypassActiveCheck: true },
    {
      loadUser: async (userId) => {
        const snap = await db.collection('users').doc(userId).get();
        return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
      },
      // User-triggered runs always get a fresh attempt — never block on a
      // stuck 'processing' record from a previous timeout or crash.
      getExistingRun: async (_runId) => null,
      markRun: async (runId, patch) => {
        await db.collection('cronRuns').doc(runId).set(
          { userId: uid, runDate, dispatchSource: 'user-triggered', ...patch },
          { merge: true }
        );
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
            getAdminDb: () => db,
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

        await db.collection('users').doc(userId).set(stripUndefinedDeep(userPatch), { merge: true });

        const sources: Record<string, number> = {};
        for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

        await db
          .collection('users').doc(userId)
          .collection('daily_matches').doc(date)
            .set(stripUndefinedDeep({
              userId,
              date,
            generatedAt: fetchedAt,
            jobs,
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
            }));
      },
    }
  );

  if (result.status !== 'completed') {
    const runSnap = await db.collection('cronRuns').doc(`${uid}_${runDate}`).get().catch(() => null);
    const failureReason = runSnap?.exists ? runSnap.data()?.failureReason : undefined;
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
  const db = getAdminDb();
  const snap = await db.collection('users').doc(uid).collection('daily_matches').doc(runDate).get();
  if (snap.exists) return (snap.data()?.jobs || []) as DailyJob[];

  const userSnap = await db.collection('users').doc(uid).get();
  return userSnap.exists ? ((userSnap.data()?.dailyJobs || []) as DailyJob[]) : [];
}

function wantsForceRerun(req: VercelRequest): boolean {
  return req.body?.force === true;
}

async function handleAsyncDispatch(uid: string, req: VercelRequest, res: VercelResponse) {
  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const profile = userSnap.data() || {};
  const careerPaths = resolveCareerPaths(profile);
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
    console.log('[api/jobs] Running inline Scout pipeline on Vercel', { firstRun, force });
    const pipelineResult = await runPipeline(uid, runDate, req);
    const jobs = pipelineResult.jobs.length > 0 ? pipelineResult.jobs : await readStoredJobs(uid, runDate);

    if (pipelineResult.status !== 'completed') {
      const failureReason =
        (pipelineResult.debug as any)?.failureReason ||
        (pipelineResult.debug as any)?.emptyReason;
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
      firstRun,
      message: jobs.length > 0
        ? `${jobs.length} jobs curated for you.`
        : 'No matching jobs were found. Try broadening your career paths in Settings.',
    });
  }

  const pipelineResult = await runPipeline(uid, runDate, req);
  const jobs = pipelineResult.jobs.length > 0 ? pipelineResult.jobs : await readStoredJobs(uid, runDate);
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
  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
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

    // Surface diagnostics so the client can show a useful error instead of
    // a generic "expired token" string. The token is a short-lived Firebase
    // ID token — if verification fails it is almost always one of:
    //   - service-account project mismatch
    //   - malformed FIREBASE_SERVICE_ACCOUNT_KEY (JSON parse / private key)
    //   - clock skew on the verifier
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
