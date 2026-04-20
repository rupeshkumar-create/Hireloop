/**
 * POST /api/blog/seed-strategy
 * One-time endpoint to initialize the marketing strategy in Firestore.
 * Protected by CRON_SECRET. Call once after deploying.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../src/server/cronAuth.js';
import { loadStrategy, initializeStrategy, runWeeklyAnalysis } from '../../src/server/marketingEngine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  try {
    const existing = await loadStrategy();
    if (existing && req.query.force !== 'true') {
      return res.status(200).json({
        message: 'Strategy already exists. Pass ?force=true to reinitialize.',
        version: existing.version,
        pendingTopics: existing.pendingTopics.length,
      });
    }

    const strategy = await initializeStrategy();

    // Optionally run analysis immediately to freshen with web data
    if (req.query.analyze === 'true') {
      const updated = await runWeeklyAnalysis(strategy);
      return res.status(200).json({
        message: 'Strategy initialized and refreshed with live web research.',
        version: updated.version,
        pendingTopics: updated.pendingTopics.length,
      });
    }

    return res.status(200).json({
      message: 'Strategy initialized successfully.',
      version: strategy.version,
      pendingTopics: strategy.pendingTopics.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
