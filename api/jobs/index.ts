import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
import { processUserCronRun } from '../../src/services/cronEngine.js';
import { computeMatchReadiness } from '../../src/services/jobDeliveryProfile.js';
import { researchJobs, jobFingerprint } from '../../src/services/jobResearcher.js';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine.js';
import { createOpenRouterCaller } from '../../src/services/openRouterCaller.js';
import type { DailyJob } from '../../src/types/dailyJob.js';
import { loadAtsAllowlist } from '../../src/services/jobSources/atsAllowlist.js';
import { fetchAtsJobs } from '../../src/services/jobSources/atsOrchestrator.js';
import { verifyHttpUrl } from '../../src/services/urlVerifier.js';
import { formatLocalDate } from '../../src/lib/localDate.js';
import { stripUndefinedDeep } from '../../src/lib/firestoreSanitizer.js';
import { evaluateScoutDedup } from '../../src/server/scoutDedup.js';

const MAX_SEEN_FINGERPRINTS = 500;

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

function getBaseUrl(req: VercelRequest): string {
  const proto =
    Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || process.env.VERCEL_URL;
  if (!host) throw new Error('Cannot determine request host');
  return `${proto}://${host}`;
}

function isLocalRequest(req: VercelRequest): boolean {
  return Boolean(
    req.headers.host?.includes('localhost') ||
    req.headers.host?.includes('127.0.0.1')
  );
}

function normalizeGithubRepoValue(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  return value
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function resolveGithubRepo(): string {
  const explicit = normalizeGithubRepoValue(process.env.GITHUB_REPO || '');
  if (explicit) return explicit;

  const owner = (process.env.VERCEL_GIT_REPO_OWNER || '').trim();
  const slug = (process.env.VERCEL_GIT_REPO_SLUG || '').trim();
  if (owner && slug) return `${owner}/${slug}`;

  return '';
}

function resolveGithubDispatchToken(): string {
  return (
    (process.env.GITHUB_DISPATCH_TOKEN || '').trim() ||
    (process.env.GITHUB_PAT || '').trim()
  );
}

function resolveGithubRef(): string {
  return (
    (process.env.GITHUB_DISPATCH_REF || '').trim() ||
    (process.env.VERCEL_GIT_COMMIT_REF || '').trim() ||
    'main'
  );
}

function githubDispatchHint(status: number): string {
  if (status === 401 || status === 403) {
    return 'Check GITHUB_DISPATCH_TOKEN permissions and repository access.';
  }
  if (status === 404) {
    return 'Check GITHUB_REPO or confirm the Vercel project is linked to the correct GitHub repository.';
  }
  if (status === 422) {
    return 'Check that .github/workflows/generate-jobs.yml includes repository_dispatch for generate-jobs-for-user.';
  }
  return 'Check the GitHub Actions workflow and repository dispatch configuration.';
}

async function dispatchRepositoryEvent(
  githubRepo: string,
  githubToken: string,
  uid: string,
  runDate: string
): Promise<Response> {
  return await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'hireschema-job-dispatch',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'generate-jobs-for-user',
      client_payload: { userId: uid, runDate, force: true },
    }),
  });
}

async function dispatchWorkflowRun(
  githubRepo: string,
  githubToken: string,
  uid: string
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  
  try {
    return await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/generate-jobs.yml/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'hireschema-job-dispatch',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: resolveGithubRef(),
        inputs: { user_id: uid },
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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

type PipelineOptions = {
  /** Smaller discovery + deterministic scoring — fits Vercel 60s for first-time users. */
  fastMode?: boolean;
};

function isFirstScoutRun(profile: Record<string, any>): boolean {
  return !profile.lastSuccessfulJobRunLocalDate;
}

function wantsFirstRun(req: VercelRequest): boolean {
  return req.body?.firstRun === true;
}

async function runPipeline(
  uid: string,
  runDate: string,
  _req: VercelRequest,
  options: PipelineOptions = {}
): Promise<JobPipelineResult> {
  const { fastMode = false } = options;
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
        console.log('[api/jobs] Career paths:', careerPaths);
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'remote';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];
        const targetDiscoveryCount = fastMode
          ? Math.max(12, limit * 2)
          : Math.max(30, limit * 6);

        console.log('[api/jobs] Checking ATS sources...', fastMode ? '(fast mode)' : '');
        const atsSources = await loadAtsAllowlist(() => db).catch(() => []);
        console.log('[api/jobs] Found ATS sources:', atsSources.length);

        const atsJobs = atsSources.length
          ? await fetchAtsJobs(atsSources, {
              fetchFn: fetch,
              verifyUrl: async (url) => await verifyHttpUrl(url),
              seenFingerprints,
              maxJobs: targetDiscoveryCount,
              concurrency: fastMode ? 6 : 8,
              perSourceTimeoutMs: fastMode ? 3000 : 4500,
            })
          : [];
        console.log('[api/jobs] Found ATS jobs:', atsJobs.length);
        debug = {
          ...debug,
          careerPaths,
          jobType,
          hasResumeText: resumeText.trim().length > 0,
          atsSourceCount: atsSources.length,
          atsJobCount: atsJobs.length,
          targetDiscoveryCount,
        };

        const byFingerprint = new Set<string>();
        const combined: any[] = [];
        for (const job of atsJobs) {
          if (!job?.fingerprint) continue;
          if (byFingerprint.has(job.fingerprint)) continue;
          byFingerprint.add(job.fingerprint);
          combined.push(job);
        }

        const apifyMinGap = fastMode ? 8 : targetDiscoveryCount;
        if (combined.length < apifyMinGap) {
          const missing = targetDiscoveryCount - combined.length;
          console.log(`[api/jobs] Discovery gap: ${missing}. Calling researchJobs...`);
          const { jobs: feedJobs } = await researchJobs(
            {
              careerPaths,
              resumeText,
              jobType,
              location,
              targetCount: fastMode ? Math.max(8, missing) : Math.max(20, missing),
            }
          );
          console.log('[api/jobs] researchJobs returned:', feedJobs.length);
          debug = {
            ...debug,
            apifyJobCount: feedJobs.length,
          };
          for (const job of feedJobs) {
            if (!job?.fingerprint) continue;
            if (byFingerprint.has(job.fingerprint)) continue;
            byFingerprint.add(job.fingerprint);
            combined.push(job);
            if (combined.length >= targetDiscoveryCount) break;
          }
        }

        const discovered = combined;
        console.log('[api/jobs] Total discovered jobs for matching:', discovered.length);
        debug = {
          ...debug,
          discoveredCount: discovered.length,
        };

        if (discovered.length === 0) {
          debug = {
            ...debug,
            matchedCount: 0,
            emptyReason: 'No jobs discovered from ATS or Apify.',
          };
          return { jobs: [], requestedLimit: limit, usedBackfill: false, totalValidatedJobs: 0, unseenCount: 0, seenCount: 0 };
        }

        const matchResult = await matchAndRankJobs(
          discovered,
          {
            careerPaths,
            resumeText,
            jobType,
            seenFingerprints,
            limit,
            minMatchScore: fastMode ? 62 : undefined,
            matchingPreferences: profile.matchingPreferences || profile.preferences,
            deliveryTimezone: profile.deliveryTimezone,
            structuredProfile: profile.structuredProfile,
          },
          fastMode ? undefined : createOpenRouterCaller(),
        );
        debug = {
          ...debug,
          matchedCount: matchResult.jobs.length,
          scoredCount: matchResult.scoredCount,
          usedFallback: matchResult.usedFallback,
          qualityFilteredCount: matchResult.qualityFilteredCount,
          dedupedCount: matchResult.dedupedCount,
          emptyReason: matchResult.jobs.length === 0 ? 'Jobs were discovered but no jobs survived matching.' : undefined,
        };

        return {
          jobs: matchResult.jobs,
          requestedLimit: limit,
          usedBackfill: matchResult.usedFallback,
          totalValidatedJobs: matchResult.scoredCount,
          unseenCount: matchResult.scoredCount,
          seenCount: 0,
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

        await db.collection('users').doc(userId).set(
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
            lastSuccessfulJobRunLocalDate: date,
            matchReadiness: profile.matchReadiness,
            seenJobFingerprints: nextFingerprints,
          }),
          { merge: true }
        );

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

async function handleAsyncDispatch(uid: string, req: VercelRequest, res: VercelResponse) {
  const githubToken = resolveGithubDispatchToken();
  const githubRepo = resolveGithubRepo();

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const profile = userSnap.data() || {};
  const careerPaths = resolveCareerPaths(profile);
  const runDate = formatLocalDate(new Date(), profile.deliveryTimezone || 'UTC');

  const dedup = evaluateScoutDedup(profile);
  if (dedup.blocked) {
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

  const firstRun = wantsFirstRun(req) || isFirstScoutRun(profile);
  if (firstRun && !isLocalRequest(req)) {
    console.log('[api/jobs] First-time Scout — running inline fast pipeline on Vercel');
    const pipelineResult = await runPipeline(uid, runDate, req, { fastMode: true });
    const jobs = pipelineResult.jobs.length > 0 ? pipelineResult.jobs : await readStoredJobs(uid, runDate);

    if (pipelineResult.status !== 'completed') {
      const failureReason =
        (pipelineResult.debug as any)?.failureReason ||
        (pipelineResult.debug as any)?.emptyReason;
      return res.status(500).json({
        error: failureReason || 'First-time job generation did not complete.',
        status: pipelineResult.status,
        debug: pipelineResult.debug,
      });
    }

    return res.status(200).json({
      status: 'completed',
      runDate,
      jobs,
      jobCount: jobs.length,
      firstRun: true,
      message: jobs.length > 0
        ? `${jobs.length} jobs curated for you.`
        : 'No matching jobs were found. Try broadening your career paths in Settings.',
    });
  }

  const isLocal = isLocalRequest(req);

  // On Vercel/serverless we must dispatch to GitHub Actions. The synchronous
  // pipeline is too slow and causes the 30s/60s request to die with HTTP 500.
  if (!isLocal && !githubToken) {
    return res.status(500).json({
      error: 'Missing GITHUB_DISPATCH_TOKEN.',
      detail: 'On Vercel, daily job generation takes ~2 minutes and must run via GitHub Actions. Please add GITHUB_DISPATCH_TOKEN to your Vercel Environment Variables.'
    });
  }

  if (!isLocal && !githubRepo) {
    return res.status(500).json({
      error: 'Could not resolve GitHub repository.',
      detail: 'Set GITHUB_REPO (e.g. "owner/repo") in your Vercel environment so the Scout can dispatch job discovery tasks.'
    });
  }

  if (githubToken && githubRepo && !isLocal) {
    console.log('[api/jobs] Dispatching to GitHub Actions...');
    let ghResponse: Response;
    const ghAbort = new AbortController();
    const ghTimeout = setTimeout(() => ghAbort.abort(), 5000);
    try {
      ghResponse = await dispatchRepositoryEvent(githubRepo, githubToken, uid, runDate);
    } catch (fetchErr) {
      console.error('[jobs/index] GitHub fetch threw:', fetchErr);
      ghResponse = { ok: false, status: 0 } as any;
    } finally {
      clearTimeout(ghTimeout);
    }

    if (ghResponse.ok) {
      return res.status(202).json({
        status: 'dispatched',
        runDate,
        message: 'Job generation started. Your dashboard will update automatically in about 2 minutes.',
      });
    }

    const dispatchBody = ghResponse.text ? await ghResponse.text().catch(() => '') : '';
    console.error('[jobs/index] Repository dispatch failed:', ghResponse.status, dispatchBody);

    try {
      const workflowResponse = await dispatchWorkflowRun(githubRepo, githubToken, uid);
      if (workflowResponse.ok) {
        return res.status(202).json({
          status: 'dispatched',
          runDate,
          message: 'Job generation started via GitHub workflow dispatch. Your dashboard will update automatically in about 2 minutes.',
        });
      }

      const workflowBody = workflowResponse.text ? await workflowResponse.text().catch(() => '') : '';
      console.error('[jobs/index] Workflow dispatch failed:', workflowResponse.status, workflowBody);
      return res.status(500).json({
        error:
          `GitHub job dispatch failed (${ghResponse.status || 'network error'}), and workflow dispatch also failed (${workflowResponse.status || 'network error'}). ` +
          githubDispatchHint(workflowResponse.status || ghResponse.status || 0),
      });
    } catch (workflowErr) {
      console.error('[jobs/index] Workflow dispatch threw:', workflowErr);
      return res.status(500).json({
        error: `GitHub job dispatch failed (${ghResponse.status || 'network error'}). ${githubDispatchHint(ghResponse.status || 0)}`,
      });
    }
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

  const fastMode = wantsFirstRun(req) || isFirstScoutRun(profile);
  const pipelineResult = await runPipeline(uid, runDate, req, { fastMode });
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
