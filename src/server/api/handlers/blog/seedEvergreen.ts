/**
 * POST /api/blog/seed-evergreen
 * Seeds 10 evergreen blog posts (2000+ words, SEO + LLM fields, internal links).
 * Protected by CRON_SECRET. Call once after deploying.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../../cronAuth.js';
import { seedEvergreenPosts } from '../../../contentGrowth/seedEvergreen.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  try {
    const force = req.query.force === 'true';
    const result = await seedEvergreenPosts({ force });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
