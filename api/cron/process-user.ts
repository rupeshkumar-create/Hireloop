import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jobFingerprint } from '../../src/services/serperService';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import { processUserCronRun } from '../../src/services/cronEngine';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { requireInternalCronSecret } from '../_lib/cronAuth';

const MAX_SEEN_FINGERPRINTS = 300;

function getRequestBaseUrl(req: VercelRequest): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || 'https';
  const host = req.headers.host || process.env.VERCEL_URL;

  if (!host) {
    throw new Error('Missing request host');
  }

  return `${protocol}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireInternalCronSecret(req, res)) {
    return;
  }

  const { userId, runDate } = req.body || {};
  if (!userId || !runDate) {
    return res.status(400).json({ error: 'Missing userId or runDate' });
  }

  try {
    const db = await getAdminDb();
    const baseUrl = getRequestBaseUrl(req);

    const result = await processUserCronRun(
      { userId, runDate },
      {
        loadUser: async (targetUserId) => {
          const snap = await db.collection('users').doc(targetUserId).get();
          return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
        },
        getExistingRun: async (runId) => {
          const snap = await db.collection('cronRuns').doc(runId).get();
          return snap.exists ? ({ id: snap.id, ...(snap.data() || {}) } as any) : null;
        },
        markRun: async (runId, patch) => {
          await db.collection('cronRuns').doc(runId).set(
            {
              userId,
              runDate,
              dispatchSource: 'daily-alerts',
              ...patch,
            },
            { merge: true }
          );
        },
        generateJobs: async (profile, limit) => {
          const { generateDailyJobs } = await import('../../src/services/aiService');

          return generateDailyJobs(
            profile.careerPaths || [],
            profile.jobType || 'both',
            profile.minSalary || null,
            profile.resumeText || '',
            limit,
            profile.seenJobFingerprints || [],
            profile.learningProfile?.jobPreferences || '',
            profile.location || '',
            profile.learningSignals
          );
        },
        storeJobs: async (targetUserId, targetRunDate, profile, generated) => {
          const fetchedAt = new Date().toISOString();
          const jobs = generated.jobs || [];
          const nextFingerprints = [
            ...(profile.seenJobFingerprints || []),
            ...jobs.map((job: any) => jobFingerprint(job.title, job.company)),
          ].slice(-MAX_SEEN_FINGERPRINTS);

          await db.collection('users').doc(targetUserId).set(
            {
              dailyJobs: jobs,
              lastJobFetchTime: fetchedAt,
              seenJobFingerprints: nextFingerprints,
            },
            { merge: true }
          );

          await db
            .collection('users')
            .doc(targetUserId)
            .collection('daily_matches')
            .doc(targetRunDate)
            .set(
              {
                jobs,
                fetchedAt,
              },
              { merge: true }
            );
        },
        sendDailyEmail: async (email, jobs) => {
          const response = await fetch(`${baseUrl}/api/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildDailyJobAlertsEmailPayload(email, jobs)),
          });

          if (!response.ok) {
            throw new Error('Failed to send daily alert email');
          }
        },
      }
    );

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
