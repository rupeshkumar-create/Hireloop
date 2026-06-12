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
 *
 * Pro users  → 10 jobs/day
 * Free users →  1 job/day
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../../firebaseAdmin.js';
import { requireInternalCronSecret } from '../../../cronAuth.js';
import { processUserCronRun } from '../../../../services/cronEngine.js';
import { computeNextJobDeliveryAt } from '../../../../services/jobDeliveryProfile.js';
import { discoverJobsForMatching } from '../../src/services/discoverJobs.js';
import { jobFingerprint } from '../../src/services/jobResearcher.js';
import { matchAndRankJobs } from '../../../../services/jobMatchingEngine.js';
import { createOpenRouterCaller } from '../../../../services/openRouterCaller.js';
import type { DailyJob } from '../../../../types/dailyJob.js';
import { stripUndefinedDeep } from '../../../../lib/firestoreSanitizer.js';

const MAX_SEEN_FINGERPRINTS = 500; // ~50 days of 10 jobs/day

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireInternalCronSecret(req, res)) return;

  const { userId, runDate } = req.body || {};
  if (!userId || !runDate) {
    return res.status(400).json({ error: 'Missing userId or runDate' });
  }

  try {
    const db = getAdminDb();

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
          const careerPaths: string[] = [
            ...new Set([
              ...(profile.careerPaths || []),
              ...(profile.structuredProfile?.roles || []),
            ]),
          ]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 10);
          const resumeText: string = profile.resumeText || '';
          const jobType: string = profile.jobType || 'remote';
          const location: string = profile.location || '';
          const seenFingerprints: string[] = profile.seenJobFingerprints || [];

          const targetCount = profile.plan === 'pro' ? 100 : 60;
          const { jobs: discovered, sources } = await discoverJobsForMatching({
            careerPaths,
            resumeText,
            jobType,
            location,
            targetCount,
            seenFingerprints,
            getAdminDb: () => db,
          });

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
              minMatchScore: 55,
              matchingPreferences: profile.matchingPreferences || profile.preferences,
              deliveryTimezone: profile.deliveryTimezone,
              structuredProfile: profile.structuredProfile,
            },
            createOpenRouterCaller(),
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
                qualityLimited,
                warnings,
              },
              lastJobFetchTime: fetchedAt,
              ...(jobs.length > 0 ? { lastSuccessfulJobRunLocalDate: date } : {}),
              nextJobDeliveryAt: jobs.length > 0
                ? computeNextJobDeliveryAt(
                    deliveryTimezone,
                    preferredDeliveryHour,
                    new Date(fetchedAt)
                  )
                : profile.nextJobDeliveryAt,
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
              qualityLimited,
              warnings,
            }));
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
