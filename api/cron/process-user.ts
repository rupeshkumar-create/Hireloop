/**
 * /api/cron/process-user
 *
 * Per-user job generation pipeline:
 *
 *  1. Load user profile from Firestore
 *  2. Feed/API job discovery from configured RSS/API sources
 *  3. Deduplicate against user's seen fingerprints
 *  4. Deterministic scoring against resume, career paths, and preferences
 *  5. Store match reasons, gaps, and summaries with each job
 *  6. Store complete job objects in Firestore (inline, no redirects)
 *  7. Update seenJobFingerprints (capped at MAX_SEEN)
 *  8. Send email digest via Resend
 *
 * Pro users  → 10 jobs/day
 * Free users →  1 job/day
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../src/server/firebaseAdmin.js';
import { requireInternalCronSecret } from '../../src/server/cronAuth.js';
import { processUserCronRun } from '../../src/services/cronEngine';
import { computeNextJobDeliveryAt } from '../../src/services/jobDeliveryProfile';
import { researchJobs, jobFingerprint } from '../../src/services/jobResearcher';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import type { DailyJob } from '../../src/types/dailyJob';
import { stripUndefinedDeep } from '../../src/lib/firestoreSanitizer';

const MAX_SEEN_FINGERPRINTS = 500; // ~50 days of 10 jobs/day

function getBaseUrl(req: VercelRequest): string {
  const proto =
    Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || process.env.VERCEL_URL;
  if (!host) throw new Error('Cannot determine request host');
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireInternalCronSecret(req, res)) return;

  const { userId, runDate } = req.body || {};
  if (!userId || !runDate) {
    return res.status(400).json({ error: 'Missing userId or runDate' });
  }

  try {
    const db = getAdminDb();
    const baseUrl = getBaseUrl(req);

    const result = await processUserCronRun(
      { userId, runDate },
      {
        // ── Load user ───────────────────────────────────────────────────────
        loadUser: async (uid) => {
          const snap = await db.collection('users').doc(uid).get();
          return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
        },

        // ── Cron run record helpers ─────────────────────────────────────────
        getExistingRun: async (runId) => {
          const snap = await db.collection('cronRuns').doc(runId).get();
          return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
        },
        markRun: async (runId, patch) => {
          await db.collection('cronRuns').doc(runId).set(
            { userId, runDate, dispatchSource: 'daily-alerts-v2', ...patch },
            { merge: true }
          );
        },

        // ── Job generation ──────────────────────────────────────────────────
        generateJobs: async (profile, limit) => {
          const careerPaths: string[] = profile.careerPaths || [];
          const resumeText: string = profile.resumeText || '';
          const jobType: string = profile.jobType || 'remote';
          const location: string = profile.location || '';
          const seenFingerprints: string[] = profile.seenJobFingerprints || [];

          const targetCount = profile.plan === 'pro' ? 100 : 60;
          const { jobs: discovered, sources } = await researchJobs(
            { careerPaths, resumeText, jobType, location, targetCount }
          );

          console.log(
            `[process-user] ${userId}: discovered ${discovered.length} jobs`,
            sources
          );

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
              resumeText,
              jobType,
              seenFingerprints,
              limit,
              minMatchScore: 75,
              matchingPreferences: profile.matchingPreferences || profile.preferences,
            }
          );

          console.log(
            `[process-user] ${userId}: matched ${matchResult.jobs.length} jobs ` +
            `(fallback=${matchResult.usedFallback})`
          );

          const qualityFilteredCount =
            'qualityFilteredCount' in matchResult &&
            typeof matchResult.qualityFilteredCount === 'number'
              ? matchResult.qualityFilteredCount
              : 0;
          const dedupedCount =
            'dedupedCount' in matchResult &&
            typeof matchResult.dedupedCount === 'number'
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

        // ── Store results ───────────────────────────────────────────────────
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

          await db.collection('users').doc(uid).set(
            stripUndefinedDeep({
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
              nextJobDeliveryAt: computeNextJobDeliveryAt(
                deliveryTimezone,
                preferredDeliveryHour,
                new Date(fetchedAt)
              ),
              matchReadiness: profile.matchReadiness,
              seenJobFingerprints: nextFingerprints,
            }),
            { merge: true }
          );

          const sources: Record<string, number> = {};
          for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

          await db
            .collection('users')
            .doc(uid)
            .collection('daily_matches')
            .doc(date)
            .set(stripUndefinedDeep({
              userId: uid,
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
            }));
        },

        // ── Send email ──────────────────────────────────────────────────────
        sendDailyEmail: async (email, jobs) => {
          const response = await fetch(`${baseUrl}/api/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildDailyJobAlertsEmailPayload(email, jobs)),
          });
          if (!response.ok) throw new Error('Failed to send daily alert email');

          await db.collection('users').doc(userId).set(
            {
              dailyJobsMeta: { emailSent: true },
            },
            { merge: true }
          );
        },
      }
    );

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[process-user] ${userId} failed:`, message);
    return res.status(500).json({ error: message });
  }
}
