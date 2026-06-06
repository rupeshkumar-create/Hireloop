/**
 * /api/cron/monthly-learning
 *
 * Runs on the 1st of each month.
 * Analyzes traffic winners/losers, emerging keywords, refreshes content,
 * and updates the monthly content strategy.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../../cronAuth.js';
import { runMonthlyLearningLoop } from '../../../contentGrowth/orchestrator.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return;

  try {
    const reportId = await runMonthlyLearningLoop();
    return res.status(200).json({
      success: true,
      reportId,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[monthly-learning] Failed:', message);
    return res.status(500).json({ error: message });
  }
}
