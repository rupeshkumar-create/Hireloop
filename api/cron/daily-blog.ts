/**
 * /api/cron/daily-blog
 *
 * Runs once per day (scheduled in vercel.json).
 * Picks the next topic from the strategy, researches it via Perplexity,
 * generates a full SEO + LLM-optimized blog post, and saves it to Firestore.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../src/server/cronAuth.js';
import { runDailyContentPipeline } from '../../src/server/contentGrowth/orchestrator.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return;

  try {
    const result = await runDailyContentPipeline({ dryRun: false });
    return res.status(200).json({
      success: true,
      slug: result.slug,
      title: result.title,
      seoScore: result.seoScore,
      llmScore: result.llmScore,
      llmGrade: result.llmGrade,
      clusterId: result.clusterId,
      durationMs: result.pipeline.totalDurationMs,
      publishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[daily-blog] Failed:', message);
    return res.status(500).json({ error: message });
  }
}
