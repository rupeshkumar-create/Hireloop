/**
 * /api/cron/daily-alerts
 *
 * Dispatcher: runs once daily (Vercel Cron / external scheduler).
 * Fetches every active Pro user and fires off /api/cron/process-user for each.
 *
 * A user is "active" when:
 *   - plan === 'pro'
 *   - receiveDailyAlerts !== false
 *
 * Free users get 1 match; Pro users get 10.
 * The per-user work (harvest → rank → store → email) happens in process-user.ts.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { requireCronSecret } from '../_lib/cronAuth.js';
import { getCronRunDateIST, isActiveCronUser, queueCronRun } from '../../src/services/cronEngine';

const DISPATCH_BATCH_SIZE = 20;

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

    const snapshot = await db.collection('users').limit(DISPATCH_BATCH_SIZE).get();

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
