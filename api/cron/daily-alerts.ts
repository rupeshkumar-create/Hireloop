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
import {
  buildCronRunId,
  evaluateDueUsers,
  queueCronRun,
} from '../../src/services/cronEngine.js';

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

    const { due, skipped: skippedUsers, inactive } = evaluateDueUsers(
      dueSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data(),
      })),
      now
    );

    let queued = 0;
    let skipped = skippedUsers.length;
    let duplicates = 0;
    let autoPaused = 0;
    let inactiveSkipped = 0;
    const errors: string[] = [];

    // ── Inactivity gate ─────────────────────────────────────────────────────
    // Persist the auto-pause flag and write a `skipped` cronRuns record so
    // the dashboard can show "Resume daily alerts" and we have an audit
    // trail — but never fire the expensive per-user pipeline for these.
    // This is the actual cost cut: 4+ day inactive users no longer trigger
    // researchJobs + AI ranking every morning.
    const runDateForAudit = now.toISOString().slice(0, 10);
    for (const user of inactive) {
      const failureReason =
        user.inactivity.reason === 'auto_paused'
          ? 'Daily alerts auto-paused — awaiting manual resume.'
          : `User inactive for ${user.inactivity.daysInactive} day(s); auto-pausing daily alerts.`;

      try {
        if (user.inactivity.shouldPersistPause) {
          await db.collection('users').doc(user.id).set(
            {
              dailyAlertsAutoPaused: true,
              dailyAlertsPausedReason: user.inactivity.reason,
              dailyAlertsPausedAt: now.toISOString(),
            },
            { merge: true }
          );
          autoPaused++;
        } else {
          inactiveSkipped++;
        }

        // Best-effort audit record — keyed by date so we can see how many
        // skips a single day produced without spamming Firestore.
        const auditRunId = buildCronRunId(user.id, runDateForAudit);
        await db.collection('cronRuns').doc(auditRunId).set(
          {
            userId: user.id,
            runDate: runDateForAudit,
            status: 'skipped',
            dispatchSource: 'daily-alerts-v3',
            inactivityReason: user.inactivity.reason,
            failureReason,
            createdAt: now.toISOString(),
            completedAt: now.toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        errors.push(
          `${user.id}: failed to record inactivity skip — ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

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
      autoPaused,
      inactiveSkipped,
      inactiveTotal: inactive.length,
      runDate: due[0]?.data.deliveryLocalDate || null,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
