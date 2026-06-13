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
import { createOpenRouterCaller } from '../src/services/openRouterCaller';
import { discoverJobsForMatching } from '../src/services/discoverJobs';
import { jobFingerprint } from '../src/services/jobResearcher';
import { matchAndRankJobs } from '../src/services/jobMatchingEngine';
import {
  evaluateDueUsers,
  isActiveCronUser,
  processUserCronRun,
} from '../src/services/cronEngine';
import type { DailyJob } from '../src/types/dailyJob';
import { formatLocalDate } from '../src/lib/localDate';
import { FALLBACK_FIRESTORE_DATABASE_ID } from '../src/lib/firebaseProjectDefaults';
import { stripUndefinedDeep } from '../src/lib/firestoreSanitizer';
import { getDiscoveryPoolTarget } from '../src/lib/planLimits';

const MAX_SEEN_FINGERPRINTS = 500;
const USER_PAGE_SIZE = 200;

function resolveCareerPaths(profile: Record<string, unknown>): string[] {
  const fromCareerPaths = Array.isArray(profile.careerPaths) ? profile.careerPaths : [];
  const fromStructuredRoles = Array.isArray((profile.structuredProfile as any)?.roles)
    ? (profile.structuredProfile as any).roles
    : [];

  return [...new Set([...fromCareerPaths, ...fromStructuredRoles])]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 10);
}

// ── OpenRouter AI caller ─────────────────────────────────────────────────────
// matchAndRankJobs needs an AI scorer to rank Apify's broad pull by actual
// fit to the user's resume + career paths.
const callOpenRouter = createOpenRouterCaller();

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
        if (force) return null;
        const snap = await db.collection('cronRuns').doc(runId).get();
        if (!snap.exists) return null;
        return { id: snap.id, ...snap.data() } as any;
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
        const careerPaths = resolveCareerPaths(profile);
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'remote';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];
        const targetDiscoveryCount = getDiscoveryPoolTarget(profile.plan);

        const { jobs: combined } = await discoverJobsForMatching({
          careerPaths,
          resumeText,
          jobType,
          location,
          targetCount: targetDiscoveryCount,
          seenFingerprints,
          getAdminDb: () => db,
        });

        console.log(`  total discovered ${combined.length} jobs`);
        if (combined.length === 0) {
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
          combined,
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
          callOpenRouter,
        );
        console.log(`  matched ${matchResult.jobs.length} jobs`);

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

      storeJobs: async (uid, date, profile, generated) => {
        const fetchedAt = new Date().toISOString();
        const jobs: DailyJob[] = generated.jobs || [];
        const requestedLimit = generated.requestedLimit ?? jobs.length;
        const deliveryTimezone = profile.deliveryTimezone || 'UTC';

        const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
        const nextFingerprints = [
          ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
        ].slice(-MAX_SEEN_FINGERPRINTS);

        // dailyJobsMeta MUST be refreshed every run. The frontend's
        // resolveLocalDateForLastFetch prefers dailyJobsMeta.deliveryLocalDate
        // over lastJobFetchTime, so if we leave a stale meta from yesterday
        // the dashboard keeps spinning indefinitely.
        await db.collection('users').doc(uid).set(
          stripUndefinedDeep({
            dailyJobs: jobs,
            lastJobFetchTime: fetchedAt,
            ...(jobs.length > 0 ? { lastSuccessfulJobRunLocalDate: date } : {}),
            seenJobFingerprints: nextFingerprints,
            dailyJobsMeta: {
              requestedLimit,
              returnedCount: jobs.length,
              qualityFilteredCount: generated.qualityFilteredCount ?? 0,
              dedupedCount: generated.dedupedCount ?? 0,
              deliveryTimezone,
              deliveryLocalDate: date,
              qualityLimited: jobs.length < requestedLimit,
            },
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
          .set(
            stripUndefinedDeep({
              userId: uid,
              date,
              generatedAt: fetchedAt,
              jobs,
              jobCount: jobs.length,
              sources,
              requestedLimit,
              returnedCount: jobs.length,
              deliveryTimezone,
              deliveryLocalDate: date,
              qualityLimited: jobs.length < requestedLimit,
            })
          );
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
  console.log('[generate-daily-jobs] Cron run — loading active users');

  const activeUsers: { id: string; data: FirebaseFirestore.DocumentData }[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  for (;;) {
    let q = db.collection('users').orderBy('createdAt', 'asc').limit(USER_PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    for (const userDoc of snap.docs) {
      const profile = userDoc.data();
      if (isActiveCronUser(profile)) {
        activeUsers.push({ id: userDoc.id, data: profile });
      }
    }

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < USER_PAGE_SIZE) break;
  }

  const { due, skipped } = evaluateDueUsers(
    activeUsers.map((u) => ({ id: u.id, data: u.data }))
  );

  console.log(
    `[generate-daily-jobs] ${activeUsers.length} active users, ${due.length} due, ${skipped.length} skipped`
  );

  let processed = 0;
  let failed = 0;

  for (const user of due) {
    const runDate =
      user.data.deliveryLocalDate ||
      formatLocalDate(now, user.data.deliveryTimezone || 'UTC');
    console.log(`[${user.id}] processing (runDate=${runDate})…`);
    try {
      await processUser(user.id, runDate, db);
      processed++;
    } catch (err) {
      console.error(`[${user.id}] failed:`, err);
      failed++;
    }
  }

  console.log(
    `[generate-daily-jobs] Done — processed: ${processed}, failed: ${failed}, skipped: ${skipped.length}`
  );
}

main().catch((err) => {
  console.error('[generate-daily-jobs] Fatal:', err);
  process.exit(1);
});
