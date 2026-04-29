import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
import { processUserCronRun } from '../../src/services/cronEngine';
import { computeMatchReadiness } from '../../src/services/jobDeliveryProfile';
import { researchJobs, jobFingerprint } from '../../src/services/jobResearcher';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import type { DailyJob } from '../../src/types/dailyJob';
import { loadAtsAllowlist } from '../../src/services/jobSources/atsAllowlist';
import { fetchAtsJobs } from '../../src/services/jobSources/atsOrchestrator';
import { verifyHttpUrl } from '../../src/services/urlVerifier';
import { formatLocalDate } from '../../src/lib/localDate.js';

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

async function verifyUser(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) return null;

  const decoded = await getAdminAuth().verifyIdToken(idToken);
  return decoded.uid;
}

async function runPipeline(uid: string, runDate: string, req: VercelRequest): Promise<void> {
  const db = getAdminDb();
  const baseUrl = getBaseUrl(req);

  await processUserCronRun(
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
        const careerPaths: string[] = profile.careerPaths || [];
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'remote';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];
        const targetDiscoveryCount = Math.max(30, limit * 6);

        const atsSources = await loadAtsAllowlist(() => db).catch(() => []);
        const atsJobs = atsSources.length
          ? await fetchAtsJobs(atsSources, {
              fetchFn: fetch,
              verifyUrl: async (url) => await verifyHttpUrl(url),
              seenFingerprints,
              maxJobs: targetDiscoveryCount,
              concurrency: 8,
              perSourceTimeoutMs: 4500,
            })
          : [];

        const byFingerprint = new Set<string>();
        const combined: any[] = [];
        for (const job of atsJobs) {
          if (!job?.fingerprint) continue;
          if (byFingerprint.has(job.fingerprint)) continue;
          byFingerprint.add(job.fingerprint);
          combined.push(job);
        }

        if (combined.length < targetDiscoveryCount) {
          const missing = targetDiscoveryCount - combined.length;
          const { jobs: feedJobs } = await researchJobs(
            { careerPaths, resumeText, jobType, location, targetCount: Math.max(20, missing) }
          );
          for (const job of feedJobs) {
            if (!job?.fingerprint) continue;
            if (byFingerprint.has(job.fingerprint)) continue;
            byFingerprint.add(job.fingerprint);
            combined.push(job);
            if (combined.length >= targetDiscoveryCount) break;
          }
        }

        const discovered = combined;

        if (discovered.length === 0) {
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
            matchingPreferences: profile.matchingPreferences || profile.preferences,
          }
        );

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
          {
            dailyJobs: jobs,
            dailyJobsMeta: {
              requestedLimit,
              returnedCount: jobs.length,
              qualityFilteredCount,
              dedupedCount,
              deliveryTimezone,
              deliveryLocalDate: date,
              emailSent: false,
              qualityLimited,
              warnings,
            },
            lastJobFetchTime: fetchedAt,
            lastSuccessfulJobRunLocalDate: date,
            matchReadiness: profile.matchReadiness,
            seenJobFingerprints: nextFingerprints,
          },
          { merge: true }
        );

        const sources: Record<string, number> = {};
        for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

        await db
          .collection('users').doc(userId)
          .collection('daily_matches').doc(date)
          .set({
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
            emailSent: false,
            qualityLimited,
            warnings,
          });
      },
      sendDailyEmail: async (email, jobs) => {
        try {
          const response = await fetch(`${baseUrl}/api/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildDailyJobAlertsEmailPayload(email, jobs)),
          });
          if (!response.ok) console.warn('[jobs/index] Email send failed:', await response.text());
        } catch (err) {
          console.warn('[jobs/index] Email send threw:', err);
        }
      },
    }
  );
}

async function readStoredJobs(uid: string, runDate: string): Promise<DailyJob[]> {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(uid).collection('daily_matches').doc(runDate).get();
  if (snap.exists) return (snap.data()?.jobs || []) as DailyJob[];

  const userSnap = await db.collection('users').doc(uid).get();
  return userSnap.exists ? ((userSnap.data()?.dailyJobs || []) as DailyJob[]) : [];
}

async function handleAsyncDispatch(uid: string, req: VercelRequest, res: VercelResponse) {
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const profile = userSnap.data() || {};
  const careerPaths = resolveCareerPaths(profile);
  const runDate = formatLocalDate(new Date(), profile.deliveryTimezone || 'UTC');
  const readiness = computeMatchReadiness({ resumeText: profile.resumeText, careerPaths });
  if (readiness.status === 'blocked') {
    return res.status(400).json({
      error: 'Add at least one career path or upload your resume before generating jobs.',
    });
  }

  if (githubToken && githubRepo) {
    let ghResponse: Response;
    const ghAbort = new AbortController();
    const ghTimeout = setTimeout(() => ghAbort.abort(), 5000);
    try {
      ghResponse = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'generate-jobs-for-user',
          client_payload: { userId: uid, runDate, force: true },
        }),
        signal: ghAbort.signal,
      });
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

    const body = ghResponse.text ? await ghResponse.text().catch(() => '') : '';
    console.error('[jobs/index] GitHub dispatch failed:', ghResponse.status, body);
  }

  await runPipeline(uid, runDate, req);
  const jobs = await readStoredJobs(uid, runDate);
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
  await runPipeline(uid, runDate, req);
  const jobs = await readStoredJobs(uid, runDate);
  return res.status(200).json({ jobs });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid: string | null = null;
  try {
    uid = await verifyUser(req);
    if (!uid) return res.status(401).json({ error: 'Missing Authorization header' });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : 'request';

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
