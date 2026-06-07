import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

const JOBS: Record<string, () => Promise<{ default: Handler }>> = {
  tick: () => import('../../src/server/api/handlers/cron/tick.js'),
  'daily-alerts': () => import('../../src/server/api/handlers/cron/dailyAlerts.js'),
  'daily-blog': () => import('../../src/server/api/handlers/cron/dailyBlog.js'),
  'weekly-analysis': () => import('../../src/server/api/handlers/cron/weeklyAnalysis.js'),
  'monthly-learning': () => import('../../src/server/api/handlers/cron/monthlyLearning.js'),
  'process-user': () => import('../../src/server/api/handlers/cron/processUser.js'),
  'seed-library': () => import('../../src/server/api/handlers/cron/seedLibrary.js'),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const job = Array.isArray(req.query.job) ? req.query.job[0] : req.query.job;
  if (!job || !JOBS[job]) {
    return res.status(404).json({ error: `Unknown cron job: ${job ?? 'missing'}` });
  }
  const mod = await JOBS[job]();
  return mod.default(req, res);
}
