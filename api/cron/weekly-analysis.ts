/**
 * /api/cron/weekly-analysis
 *
 * Runs every Saturday (scheduled in vercel.json).
 * Uses Perplexity to research current trends, then Claude updates the
 * marketing strategy with new topic ideas and refined keywords.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../_lib/cronAuth.js';
import { loadStrategy, initializeStrategy, runWeeklyAnalysis } from '../_lib/marketingEngine.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return;

  try {
    let strategy = await loadStrategy();
    if (!strategy) {
      strategy = await initializeStrategy();
    }

    const updatedStrategy = await runWeeklyAnalysis(strategy);

    // Audit log
    const db = getAdminDb();
    await db.collection('marketing_runs').add({
      type: 'weekly_analysis',
      strategyVersion: updatedStrategy.version,
      newTopicsAdded: updatedStrategy.pendingTopics.length - strategy.pendingTopics.length,
      lastAnalysisDate: updatedStrategy.lastAnalysisDate,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      strategyVersion: updatedStrategy.version,
      pendingTopics: updatedStrategy.pendingTopics.length,
      usedTopics: updatedStrategy.usedTopics.length,
      lastAnalysisDate: updatedStrategy.lastAnalysisDate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[weekly-analysis] Failed:', message);
    return res.status(500).json({ error: message });
  }
}
