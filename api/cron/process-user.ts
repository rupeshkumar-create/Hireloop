/**
 * /api/cron/process-user
 *
 * Per-user job generation pipeline (new v2 architecture):
 *
 *  1. Load user profile from Firestore
 *  2. Build search terms from careerPaths + resumeText
 *  3. Harvest jobs from Remotive, Arbeitnow, Jobicy (+ JSearch if key present)
 *  4. Deduplicate against user's seen fingerprints
 *  5. AI batch scoring (Gemini 2.5 Pro) → pick top-N candidates
 *  6. AI enrichment (Claude claude-sonnet-4-6) → matchReasons, skillGaps, aiSummary per job
 *  7. Store complete job objects in Firestore (inline, no redirects)
 *  8. Update seenJobFingerprints (capped at MAX_SEEN)
 *  9. Send email digest via Resend
 *
 * Pro users  → 10 jobs/day
 * Free users →  1 job/day
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { requireInternalCronSecret } from '../_lib/cronAuth';
import { processUserCronRun } from '../../src/services/cronEngine';
import {
  harvestJobs,
  buildSearchTerms,
  jobFingerprint,
} from '../../src/services/jobHarvester';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import { getDailyMatchLimit } from '../../src/lib/planLimits';
import type { DailyJob } from '../../src/types/dailyJob';

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
    const rapidApiKey = process.env.RAPIDAPI_KEY;

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
          const jobType: string = profile.jobType || 'both';
          const location: string = profile.location || '';
          const seenFingerprints: string[] = profile.seenJobFingerprints || [];

          // Extract basic skills from resume for augmented search terms
          const SKILL_KEYWORDS = [
            'python', 'javascript', 'typescript', 'react', 'node', 'golang', 'java',
            'rust', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'sql', 'graphql',
            'machine learning', 'data science', 'devops', 'product management',
          ];
          const lowerResume = resumeText.toLowerCase();
          const extractedSkills = SKILL_KEYWORDS.filter((s) => lowerResume.includes(s));

          const searchTerms = buildSearchTerms(careerPaths, extractedSkills);

          // Harvest from all sources in parallel
          const { jobs: rawJobs, stats: harvestStats } = await harvestJobs(
            searchTerms,
            { jobType, location, maxPerSource: 30, maxTotal: 90 },
            rapidApiKey
          );

          console.log(`[process-user] ${userId}: harvested ${rawJobs.length} raw jobs`, harvestStats);

          if (rawJobs.length === 0) {
            return { jobs: [], requestedLimit: limit, usedBackfill: false, totalValidatedJobs: 0, unseenCount: 0, seenCount: 0 };
          }

          // AI matching: score → enrich → rank → top-N
          const matchResult = await matchAndRankJobs(rawJobs, {
            careerPaths,
            resumeText,
            jobType,
            seenFingerprints,
            limit,
          });

          console.log(`[process-user] ${userId}: matched ${matchResult.jobs.length} jobs (fallback=${matchResult.usedFallback})`);

          return {
            jobs: matchResult.jobs,
            requestedLimit: limit,
            usedBackfill: matchResult.usedFallback,
            totalValidatedJobs: matchResult.scoredCount,
            unseenCount: matchResult.scoredCount,
            seenCount: 0,
          };
        },

        // ── Store results ───────────────────────────────────────────────────
        storeJobs: async (uid, date, profile, generated) => {
          const fetchedAt = new Date().toISOString();
          const jobs: DailyJob[] = generated.jobs || [];

          // Build updated fingerprint set, cap at MAX_SEEN_FINGERPRINTS
          const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
          const nextFingerprints = [
            ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
          ].slice(-MAX_SEEN_FINGERPRINTS);

          // Store on the user doc (last-fetched cache)
          await db.collection('users').doc(uid).set(
            {
              dailyJobs: jobs,
              lastJobFetchTime: fetchedAt,
              seenJobFingerprints: nextFingerprints,
            },
            { merge: true }
          );

          // Store in historical daily_matches subcollection (full record)
          if (jobs.length > 0) {
            const sources: Record<string, number> = {};
            for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

            await db
              .collection('users')
              .doc(uid)
              .collection('daily_matches')
              .doc(date)
              .set({
                userId: uid,
                date,
                generatedAt: fetchedAt,
                jobs,
                jobCount: jobs.length,
                sources,
              });
          }
        },

        // ── Send email ──────────────────────────────────────────────────────
        sendDailyEmail: async (email, jobs) => {
          const response = await fetch(`${baseUrl}/api/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildDailyJobAlertsEmailPayload(email, jobs)),
          });
          if (!response.ok) throw new Error('Failed to send daily alert email');
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
