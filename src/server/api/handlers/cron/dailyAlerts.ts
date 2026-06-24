/**
 * /api/cron/daily-alerts — dispatcher (Supabase-backed).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../../cronAuth.js';
import { evaluateDueUsers, queueCronRun, shouldPauseForInactivity } from '../../../../services/cronEngine.js';
import { listProfilesDueForDelivery } from '../../../db/profiles.js';
import { upsertProfile } from '../../../db/profiles.js';
import { createCronRunIfAbsent } from '../../../db/cronRuns.js';

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
    const baseUrl = getBaseUrl(req);
    const now = new Date();
    const dueSnapshot = await listProfilesDueForDelivery(now.toISOString(), DISPATCH_BATCH_SIZE);

    const { due, skipped: skippedUsers } = evaluateDueUsers(dueSnapshot, now);

    let queued = 0;
    let skipped = skippedUsers.length;
    let duplicates = 0;
    let pausedInactive = 0;
    const errors: string[] = [];

    for (const loadedUser of skippedUsers) {
      if (!shouldPauseForInactivity(loadedUser.data, now)) continue;
      try {
        await upsertProfile(loadedUser.id, {
          receiveDailyAlerts: false,
          automationPausedAt: now.toISOString(),
          automationPausedReason: 'inactive_3d',
          updatedAt: now.toISOString(),
        });
        pausedInactive++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`pause:${loadedUser.id}: ${message}`);
      }
    }

    for (const loadedUser of due) {
      const profile = loadedUser.data;
      const queueResult = await queueCronRun(
        {
          userId: loadedUser.id,
          runDate: profile.deliveryLocalDate as string,
          plan: profile.plan as string,
          email: profile.email as string,
        },
        {
          createRun: async ({ runId, ...record }) =>
            createCronRunIfAbsent(runId, {
              ...record,
              status: 'queued',
              dispatchSource: 'daily-alerts-v3',
              deliveryTimezone: profile.deliveryTimezone || 'UTC',
              createdAt: new Date().toISOString(),
            }),
        },
      );

      if (queueResult.status === 'duplicate') {
        duplicates++;
        continue;
      }

      queued++;

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
      pausedInactive,
      runDate: due[0]?.data.deliveryLocalDate || null,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
