import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
import { processUserCronRun, getCronRunDateIST } from '../../src/services/cronEngine';
import { researchJobs, jobFingerprint } from '../../src/services/jobResearcher';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine';
import type { CallAIFn } from '../../src/services/jobResearcher';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import type { DailyJob } from '../../src/types/dailyJob';

const MAX_SEEN_FINGERPRINTS = 500;

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

async function handleAsyncDispatch(uid: string, res: VercelResponse) {
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken || !githubRepo) {
    return res.status(503).json({
      error: 'async_not_configured',
      message: 'GitHub Actions dispatch is not set up; use sync trigger mode instead.',
    });
  }

  const runDate = getCronRunDateIST();

  let ghResponse: Response;
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
        client_payload: { userId: uid, runDate },
      }),
    });
  } catch (fetchErr) {
    console.error('[jobs/index] GitHub fetch threw:', fetchErr);
    return res.status(503).json({
      error: 'async_not_configured',
      message: 'GitHub Actions unreachable; use sync trigger mode instead.',
    });
  }

  if (!ghResponse.ok) {
    const body = await ghResponse.text().catch(() => '');
    console.error('[jobs/index] GitHub dispatch failed:', ghResponse.status, body);

    let hint = '';
    if (ghResponse.status === 401 || ghResponse.status === 403) {
      hint = ' — check that GITHUB_DISPATCH_TOKEN has the "repo" scope';
    } else if (ghResponse.status === 404) {
      hint = ` — repo "${githubRepo}" not found or token lacks access`;
    } else if (ghResponse.status === 422) {
      hint = ' — workflow file may be missing the repository_dispatch trigger';
    }

    return res.status(502).json({
      error: `GitHub dispatch failed (HTTP ${ghResponse.status})${hint}`,
      githubStatus: ghResponse.status,
    });
  }

  return res.status(202).json({
    status: 'dispatched',
    runDate,
    message: 'Job generation started. Your dashboard will update automatically in ~2 minutes.',
  });
}

async function handleSyncTrigger(uid: string, req: VercelRequest, res: VercelResponse) {
  const db = getAdminDb();
  const runDate = getCronRunDateIST();
  const baseUrl = getBaseUrl(req);
  const callAI = makeServerCallAI();

  const result = await processUserCronRun(
    { userId: uid, runDate },
    {
      loadUser: async (userId) => {
        const snap = await db.collection('users').doc(userId).get();
        return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
      },
      getExistingRun: async (runId) => {
        const snap = await db.collection('cronRuns').doc(runId).get();
        return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
      },
      markRun: async (runId, patch) => {
        await db.collection('cronRuns').doc(runId).set(
          { userId: uid, runDate, dispatchSource: 'user-triggered', ...patch },
          { merge: true }
        );
      },
      generateJobs: async (profile, limit) => {
        const careerPaths: string[] = profile.careerPaths || [];
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'both';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];

        const { jobs: discovered } = await researchJobs(
          { careerPaths, resumeText, jobType, location, targetCount: 30 },
          callAI
        );

        if (discovered.length === 0) {
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

  const snap = await db.collection('users').doc(uid).collection('daily_matches').doc(runDate).get();
  const jobs = snap.exists ? (snap.data()?.jobs || []) : [];

  return res.status(200).json({ ...result, jobs });
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
    if (mode === 'request') return await handleAsyncDispatch(uid, res);
    if (mode === 'trigger') return await handleSyncTrigger(uid, req, res);
    return res.status(400).json({ error: 'Invalid jobs mode. Use "request" or "trigger".' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[jobs/index] Unexpected failure:', message);
    return res.status(500).json({ error: message });
  }
}
