/**
 * /api/cron/daily-blog
 *
 * Runs once per day (scheduled in vercel.json).
 * Picks the next topic from the strategy, researches it via Perplexity,
 * generates a full SEO + LLM-optimized blog post, and saves it to Firestore.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../src/server/cronAuth';
import { generateAndPublishPost } from '../../src/server/marketingEngine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return;

  try {
    const result = await generateAndPublishPost();
    return res.status(200).json({
      success: true,
      slug: result.slug,
      title: result.title,
      publishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[daily-blog] Failed:', message);
    return res.status(500).json({ error: message });
  }
}
