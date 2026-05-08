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
import { getAdminDb } from '../../src/server/firebaseAdmin.js';
import { requireCronSecret } from '../../src/server/cronAuth.js';
import { evaluateDueUsers, queueCronRun } from '../../src/services/cronEngine.js';

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
    const baseUrl = getBaseUrl(req);
    const now = new Date();
    const dueSnapshot = await db
      .collection('users')
      .where('nextJobDeliveryAt', '<=', now.toISOString())
      .orderBy('nextJobDeliveryAt', 'asc')
      .limit(DISPATCH_BATCH_SIZE)
      .get();

    const { due, skipped: skippedUsers } = evaluateDueUsers(
      dueSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data(),
      })),
      now
    );

    let queued = 0;
    let skipped = skippedUsers.length;
    let duplicates = 0;
    const errors: string[] = [];

    for (const loadedUser of due) {
      const profile = loadedUser.data;
      const queueResult = await queueCronRun(
        {
          userId: loadedUser.id,
          runDate: profile.deliveryLocalDate,
          plan: profile.plan,
          email: profile.email,
        },
        {
          createRun: async ({ runId, ...record }) => {
            const ref = db.collection('cronRuns').doc(runId);
            const existing = await ref.get();
            if (existing.exists) return false;
            await ref.set({
              ...record,
              status: 'queued',
              dispatchSource: 'daily-alerts-v3',
              deliveryTimezone: profile.deliveryTimezone || 'UTC',
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
        body: JSON.stringify({ userId: loadedUser.id, runDate: profile.deliveryLocalDate }),
      }).catch((err) => {
        errors.push(`${loadedUser.id}: ${err.message}`);
      });
    }

    return res.status(200).json({
      queued,
      skipped,
      duplicates,
      runDate: due[0]?.data.deliveryLocalDate || null,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
