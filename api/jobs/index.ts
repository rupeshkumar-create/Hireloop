import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
import { processUserCronRun, getCronRunDateIST } from '../../src/services/cronEngine';
import { computeMatchReadiness } from '../../src/services/jobDeliveryProfile';
import { researchJobs, jobFingerprint } from '../../src/services/jobResearcher';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine';
import type { CallAIFn } from '../../src/services/jobResearcher';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import type { DailyJob } from '../../src/types/dailyJob';

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

function makeServerCallAI(): CallAIFn {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  return async (messages, model) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://hireschema.com',
        'X-Title': 'HireSchema Jobs',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    return (data as any).choices?.[0]?.message?.content?.trim() || '';
  };
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

async function runPipeline(uid: string, req: VercelRequest): Promise<void> {
  const db = getAdminDb();
  const runDate = getCronRunDateIST();
  const baseUrl = getBaseUrl(req);
  const callAI = makeServerCallAI();

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

        const { jobs: discovered } = await researchJobs(
          { careerPaths, resumeText, jobType, location, targetCount: 20 },
          callAI
        );

        if (discovered.length === 0) {
          return { jobs: [], requestedLimit: limit, usedBackfill: false, totalValidatedJobs: 0, unseenCount: 0, seenCount: 0 };
        }

        const matchResult = await matchAndRankJobs(
          discovered,
          { careerPaths, resumeText, jobType, seenFingerprints, limit },
          callAI
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

        const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
        const nextFingerprints = [
          ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
        ].slice(-MAX_SEEN_FINGERPRINTS);

        await db.collection('users').doc(userId).set(
          { dailyJobs: jobs, lastJobFetchTime: fetchedAt, seenJobFingerprints: nextFingerprints },
          { merge: true }
        );

        if (jobs.length > 0) {
          const sources: Record<string, number> = {};
          for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

          await db
            .collection('users').doc(userId)
            .collection('daily_matches').doc(date)
            .set({ userId, date, generatedAt: fetchedAt, jobs, jobCount: jobs.length, sources });
        }
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

async function handleAsyncDispatch(uid: string, req: VercelRequest, res: VercelResponse) {
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;
  const runDate = getCronRunDateIST();

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'Job generation is not configured. Please set OPENROUTER_API_KEY in your environment.',
    });
  }

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const profile = userSnap.data() || {};
  const careerPaths = resolveCareerPaths(profile);
  const readiness = computeMatchReadiness({ resumeText: profile.resumeText, careerPaths });
  if (readiness.status === 'blocked') {
    return res.status(400).json({
      error: 'Add at least one career path or upload your resume before generating jobs.',
    });
  }

  res.status(202).json({
    status: githubToken && githubRepo ? 'dispatched' : 'processing',
    runDate,
    message: 'Job generation started. Your dashboard will update automatically in about 2 minutes.',
  });

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
      return;
    }

    const body = ghResponse.text ? await ghResponse.text().catch(() => '') : '';
    console.error('[jobs/index] GitHub dispatch failed:', ghResponse.status, body);
  }

  await runPipeline(uid, req).catch((err) => {
    console.error('[jobs/index] Inline pipeline error after 202:', err);
  });
}

async function handleSyncTrigger(uid: string, req: VercelRequest, res: VercelResponse) {
  await runPipeline(uid, req);
  const db = getAdminDb();
  const runDate = getCronRunDateIST();
  const snap = await db.collection('users').doc(uid).collection('daily_matches').doc(runDate).get();
  const jobs = snap.exists ? (snap.data()?.jobs || []) : [];
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
