import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { requireCronSecret } from '../_lib/cronAuth';
import {
  getCronRunDateIST,
  isActiveCronUser,
  queueCronRun,
} from '../../src/services/cronEngine';

const DISPATCH_BATCH_SIZE = 10;

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
  if (!requireCronSecret(req, res)) {
    return;
  }

  try {
    const db = getAdminDb();
    const runDate = getCronRunDateIST();
    const baseUrl = getRequestBaseUrl(req);
    const snapshot = await db.collection('users').limit(DISPATCH_BATCH_SIZE).get();

    let queued = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const userDoc of snapshot.docs) {
      const profile = userDoc.data();
      if (!isActiveCronUser(profile)) {
        skipped += 1;
        continue;
      }

      const queueResult = await queueCronRun(
        {
          userId: userDoc.id,
          runDate,
          plan: profile.plan,
          email: profile.email,
        },
        {
          createRun: async ({ runId, ...record }) => {
            const ref = db.collection('cronRuns').doc(runId);
            const existing = await ref.get();
            if (existing.exists) {
              return false;
            }

            await ref.set({
              ...record,
              status: 'queued',
              dispatchSource: 'daily-alerts',
              createdAt: new Date().toISOString(),
            });

            return true;
          },
        }
      );

      if (queueResult.status === 'duplicate') {
        duplicates += 1;
        continue;
      }

      queued += 1;

      await fetch(`${baseUrl}/api/cron/process-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          userId: userDoc.id,
          runDate,
        }),
      });
    }

    return res.status(200).json({ queued, skipped, duplicates, runDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
