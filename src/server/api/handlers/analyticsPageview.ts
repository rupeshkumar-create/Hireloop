/**
 * POST /api/analytics/pageview
 * Track page-level metrics for the Content Growth learning loop.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { incrementPageview, recordCtaClick } from '../../contentGrowth/storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body ?? {}) as {
    slug?: string;
    event?: 'pageview' | 'cta_click';
    timeOnPage?: number;
  };

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug || !slug.startsWith('blog/') && !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const normalizedSlug = slug.replace(/^blog\//, '');

  try {
    if (body.event === 'cta_click') {
      await recordCtaClick(normalizedSlug);
    } else {
      await incrementPageview(normalizedSlug, body.timeOnPage ?? 0);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
