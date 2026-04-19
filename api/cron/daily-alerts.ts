/**
 * /api/cron/daily-alerts
 *
 * Dispatcher: runs once daily (Vercel Cron / external scheduler).
 * Fetches active users and fires off /api/cron/process-user for each.
 *
 * A user is "active" when:
 *   - plan is set (any value) AND receiveDailyAlerts !== false
 *
 * Pro users  → 10 jobs/day
 * Free users →  1 job/day
 *
 * Users are ordered by lastJobFetchTime ascending so those who haven't
 * received jobs recently are always prioritised in each batch.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { requireCronSecret } from '../_lib/cronAuth.js';
import { getCronRunDateIST, isActiveCronUser, queueCronRun } from '../../src/services/cronEngine';

const DISPATCH_BATCH_SIZE = 50;

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
  if (!requireCronSecret(req, res)) return;

  try {
    const db = getAdminDb();
    const runDate = getCronRunDateIST();
    const baseUrl = getBaseUrl(req);

    // Primary query: users WITH lastJobFetchTime, stale-first.
    // Secondary query: users WITHOUT lastJobFetchTime (new accounts that were
    // created before the sentinel value was introduced). Firestore's orderBy
    // silently excludes documents that don't have the ordered field, so these
    // users would never appear in the primary query alone.
    const [primarySnapshot, secondarySnapshot] = await Promise.all([
      db.collection('users').orderBy('lastJobFetchTime', 'asc').limit(DISPATCH_BATCH_SIZE).get(),
      db.collection('users').orderBy('createdAt', 'asc').limit(DISPATCH_BATCH_SIZE).get(),
    ]);

    // Merge: primary first (stale-first ordering), then fill with secondary
    // results that weren't already included (users without lastJobFetchTime).
    const seenIds = new Set<string>();
    const mergedDocs: typeof primarySnapshot.docs = [];
    for (const docSnap of [...primarySnapshot.docs, ...secondarySnapshot.docs]) {
      if (!seenIds.has(docSnap.id)) {
        seenIds.add(docSnap.id);
        mergedDocs.push(docSnap);
      }
    }
    const snapshot = { docs: mergedDocs.slice(0, DISPATCH_BATCH_SIZE) };

    let queued = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const userDoc of snapshot.docs) {
      const profile = userDoc.data();

      if (!isActiveCronUser(profile)) {
        skipped++;
        continue;
      }

      const queueResult = await queueCronRun(
        { userId: userDoc.id, runDate, plan: profile.plan, email: profile.email },
        {
          createRun: async ({ runId, ...record }) => {
            const ref = db.collection('cronRuns').doc(runId);
            const existing = await ref.get();
            if (existing.exists) return false;
            await ref.set({
              ...record,
              status: 'queued',
              dispatchSource: 'daily-alerts-v2',
              createdAt: new Date().toISOString(),
            });
            return true;
          },
        }
      );

      if (queueResult.status === 'duplicate') {
        duplicates++;
        continue;
      }

      queued++;

      // Fire-and-forget per-user job processing
      fetch(`${baseUrl}/api/cron/process-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ userId: userDoc.id, runDate }),
      }).catch((err) => {
        errors.push(`${userDoc.id}: ${err.message}`);
      });
    }

    return res.status(200).json({ queued, skipped, duplicates, runDate, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
