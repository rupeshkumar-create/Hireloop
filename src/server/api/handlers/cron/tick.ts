/**
 * /api/cron/tick
 *
 * Single entry point for cron-job.org. Runs every scheduled task that is due
 * for the current UTC window. Configure ONE external cron job — see CRON_SETUP.md.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../../cronAuth.js';
import {
  CRON_JOBS,
  getDueCronJobs,
  VERCEL_FUNCTION_COUNT,
  VERCEL_FUNCTION_LIMIT,
  type CronJobId,
} from '../../../cronSchedule.js';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

const JOB_LOADERS: Record<CronJobId, () => Promise<{ default: Handler }>> = {
  'daily-alerts': () => import('./dailyAlerts.js'),
  'daily-blog': () => import('./dailyBlog.js'),
  'weekly-analysis': () => import('./weeklyAnalysis.js'),
  'monthly-learning': () => import('./monthlyLearning.js'),
};

function createCollectingRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    end(payload?: unknown) {
      if (payload !== undefined) this.body = payload;
      return this;
    },
  };
  return res;
}

async function runCronJob(jobId: CronJobId, req: VercelRequest) {
  const loader = JOB_LOADERS[jobId];
  const mod = await loader();
  const res = createCollectingRes();
  await mod.default(req, res);
  const ok = res.statusCode >= 200 && res.statusCode < 300;
  return { ok, statusCode: res.statusCode, body: res.body };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (!requireCronSecret(req, res)) return;
    return res.status(200).json({
      message: 'POST this endpoint once daily from cron-job.org (see docs/CRON_SETUP.md).',
      vercelFunctions: {
        used: VERCEL_FUNCTION_COUNT,
        limit: VERCEL_FUNCTION_LIMIT,
        remaining: VERCEL_FUNCTION_LIMIT - VERCEL_FUNCTION_COUNT,
      },
      scheduledJobs: CRON_JOBS,
      forceExamples: {
        single: '/api/cron/tick?force=daily-alerts',
        all: '/api/cron/tick?force=all',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST or GET.' });
  }

  if (!requireCronSecret(req, res)) return;

  const forceParam = typeof req.query.force === 'string' ? req.query.force : undefined;
  const forceBody =
    req.body && typeof req.body.force === 'string' ? (req.body.force as string) : undefined;
  const force = (forceParam || forceBody) as CronJobId | 'all' | undefined;

  const now = new Date();
  const due = getDueCronJobs(now, force ? { force } : undefined);

  if (due.length === 0) {
    return res.status(200).json({
      ran: [],
      skipped: CRON_JOBS.map((j) => j.id),
      message: 'Nothing due this window. Schedules run around 08:00 UTC daily.',
      serverTimeUtc: now.toISOString(),
    });
  }

  const results: Record<string, { ok: boolean; statusCode: number; body: unknown }> = {};
  const errors: string[] = [];

  for (const schedule of due) {
    try {
      const outcome = await runCronJob(schedule.id, req);
      results[schedule.id] = outcome;
      if (!outcome.ok) {
        errors.push(`${schedule.id} failed with HTTP ${outcome.statusCode}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${schedule.id}: ${message}`);
      results[schedule.id] = { ok: false, statusCode: 500, body: { error: message } };
    }
  }

  const ran = Object.entries(results)
    .filter(([, value]) => value.ok)
    .map(([id]) => id);
  const failed = Object.entries(results)
    .filter(([, value]) => !value.ok)
    .map(([id]) => id);

  return res.status(errors.length ? 207 : 200).json({
    ran,
    failed,
    results,
    errors,
    serverTimeUtc: now.toISOString(),
    vercelFunctions: {
      used: VERCEL_FUNCTION_COUNT,
      limit: VERCEL_FUNCTION_LIMIT,
    },
  });
}
