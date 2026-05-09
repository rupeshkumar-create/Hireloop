/**
 * scripts/generate-daily-jobs.ts
 *
 * Runs the full daily job generation pipeline for active users.
 * Designed to be executed inside GitHub Actions — no Vercel function
 * timeout constraints apply here.
 *
 * Cron mode  (process all active users):
 *   npx tsx scripts/generate-daily-jobs.ts
 *
 * Single-user mode (on-demand or testing):
 *   USER_ID=abc123 npx tsx scripts/generate-daily-jobs.ts
 *
 * Required env vars (stored as GitHub secrets):
 *   FIREBASE_SERVICE_ACCOUNT_KEY   (JSON string of service account)
 *   FIRESTORE_DATABASE_ID          (optional, omit for default database)
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Pull in shared business-logic from src/ ──────────────────────────────────
// These modules are pure TypeScript with no browser-specific imports.
// `tsx` resolves them directly at runtime.
import { researchJobs, jobFingerprint } from '../src/services/jobResearcher';
import { matchAndRankJobs } from '../src/services/jobMatchingEngine';
import {
  isActiveCronUser,
  processUserCronRun,
} from '../src/services/cronEngine';
import type { DailyJob } from '../src/types/dailyJob';
import { formatLocalDate } from '../src/lib/localDate';
import { FALLBACK_FIRESTORE_DATABASE_ID } from '../src/lib/firebaseProjectDefaults';
import { stripUndefinedDeep } from '../src/lib/firestoreSanitizer';

const MAX_SEEN_FINGERPRINTS = 500;
const BATCH_SIZE = 100;

// ── Firebase Admin init ──────────────────────────────────────────────────────

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');

  const serviceAccount = JSON.parse(raw);
  const apps = getApps();
  const app = apps.length ? apps[0] : initializeApp({ credential: cert(serviceAccount) });

  const dbId = (
    process.env.FIRESTORE_DATABASE_ID ||
    FALLBACK_FIRESTORE_DATABASE_ID ||
    ''
  ).trim();
  const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

  return { db };
}

// ── Single-user pipeline ─────────────────────────────────────────────────────

async function processUser(
  userId: string,
  runDate: string,
  db: FirebaseFirestore.Firestore,
  force = false
) {
  const result = await processUserCronRun(
    { userId, runDate, bypassActiveCheck: force },
    {
      loadUser: async (uid) => {
        const snap = await db.collection('users').doc(uid).get();
        return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
      },

      getExistingRun: async (runId) => {
        const snap = await db.collection('cronRuns').doc(runId).get();
        if (!snap.exists) return null;
        const data = { id: snap.id, ...snap.data() } as any;
        if (force && data.status !== 'processing') return null;
        return data;
      },

      markRun: async (runId, patch) => {
        await db
          .collection('cronRuns')
          .doc(runId)
          .set(
            { userId, runDate, dispatchSource: 'github-actions', ...patch },
            { merge: true }
          );
      },

      generateJobs: async (profile, limit) => {
        const careerPaths: string[] = profile.careerPaths || [];
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'both';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];

        const { jobs: discovered, sources } = await researchJobs(
          { careerPaths, resumeText, jobType, location, targetCount: 60 }
        );
        console.log(`  discovered ${discovered.length} jobs`, sources);

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
          {
            careerPaths,
            resumeText,
            jobType,
            seenFingerprints,
            limit,
            matchingPreferences: profile.matchingPreferences || profile.preferences,
          }
        );
        console.log(`  matched ${matchResult.jobs.length} jobs`);

        return {
          jobs: matchResult.jobs,
          requestedLimit: limit,
          usedBackfill: matchResult.usedFallback,
          totalValidatedJobs: matchResult.scoredCount,
          unseenCount: matchResult.scoredCount,
          seenCount: 0,
        };
      },

      storeJobs: async (uid, date, profile, generated) => {
        const fetchedAt = new Date().toISOString();
        const jobs: DailyJob[] = generated.jobs || [];

        const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
        const nextFingerprints = [
          ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
        ].slice(-MAX_SEEN_FINGERPRINTS);

        await db.collection('users').doc(uid).set(
          stripUndefinedDeep({
            dailyJobs: jobs,
            lastJobFetchTime: fetchedAt,
            seenJobFingerprints: nextFingerprints,
          }),
          { merge: true }
        );

        if (jobs.length > 0) {
          const sources: Record<string, number> = {};
          for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

          await db
            .collection('users')
            .doc(uid)
            .collection('daily_matches')
            .doc(date)
            .set(
              stripUndefinedDeep({
                userId: uid,
                date,
                generatedAt: fetchedAt,
                jobs,
                jobCount: jobs.length,
                sources,
              })
            );
        }
      },
    }
  );

  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { db } = initAdmin();
  const now = new Date();
  const specificUserId = process.env.USER_ID?.trim();
  // Single-user runs are always user-triggered (dashboard button or manual
  // workflow_dispatch), so they must bypass any prior 'completed' cronRun
  // for today. Otherwise the script returns 'skipped' and stale jobs persist.
  // Cron mode (no USER_ID) still honors FORCE_RERUN for ops overrides.
  const forceRerun = Boolean(specificUserId) || process.env.FORCE_RERUN === 'true';

  if (specificUserId) {
    // ── Single-user mode (user-triggered or admin override) ──────────────────
    console.log(`[generate-daily-jobs] Single-user mode: ${specificUserId} (force=${forceRerun})`);
    const userSnap = await db.collection('users').doc(specificUserId).get();
    const profile = userSnap.exists ? userSnap.data() || {} : {};
    const runDate = formatLocalDate(now, profile.deliveryTimezone || 'UTC');
    const result = await processUser(specificUserId, runDate, db, forceRerun);
    console.log('[generate-daily-jobs] Done:', result);
    return;
  }

  // ── All-users mode (scheduled daily cron) ────────────────────────────────
  console.log('[generate-daily-jobs] Cron run');

  // Two queries merged so users without lastJobFetchTime (new accounts) are
  // also included — they only appear in the createdAt-ordered query.
  const [primarySnap, secondarySnap] = await Promise.all([
    db.collection('users').orderBy('lastJobFetchTime', 'asc').limit(BATCH_SIZE).get(),
    db.collection('users').orderBy('createdAt', 'asc').limit(BATCH_SIZE).get(),
  ]);

  const seenIds = new Set<string>();
  const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const d of [...primarySnap.docs, ...secondarySnap.docs]) {
    if (!seenIds.has(d.id)) {
      seenIds.add(d.id);
      allDocs.push(d);
    }
  }

  let processed = 0, skipped = 0, failed = 0;

  for (const userDoc of allDocs) {
    const profile = userDoc.data();
    if (!isActiveCronUser(profile)) {
      skipped++;
      continue;
    }

    console.log(`[${userDoc.id}] processing…`);
    try {
      const runDate = formatLocalDate(now, profile.deliveryTimezone || 'UTC');
      await processUser(userDoc.id, runDate, db);
      processed++;
    } catch (err) {
      console.error(`[${userDoc.id}] failed:`, err);
      failed++;
    }
  }

  console.log(
    `[generate-daily-jobs] Done — processed: ${processed}, skipped: ${skipped}, failed: ${failed}`
  );
}

main().catch((err) => {
  console.error('[generate-daily-jobs] Fatal:', err);
  process.exit(1);
});
