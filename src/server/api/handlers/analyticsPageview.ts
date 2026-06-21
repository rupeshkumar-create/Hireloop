/**
 * POST /api/analytics/pageview
 * Track page-level metrics for the Content Growth learning loop.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { incrementPageview, recordCtaClick } from '../../contentGrowth/storage.js';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/;
const MAX_TIME_ON_PAGE_SEC = 7200;

function isAllowedOrigin(req: VercelRequest): boolean {
  const origin = (req.headers.origin || req.headers.referer || '').toLowerCase();
  if (!origin) return true;
  return (
    origin.includes('hireschema.com') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
}

function normalizeSlug(raw: string): string | null {
  const slug = raw.replace(/^blog\//, '').trim().toLowerCase();
  if (!slug || slug.length > 120) return null;
  if (!SLUG_RE.test(slug)) return null;
  return slug;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = (req.body ?? {}) as {
    slug?: string;
    event?: 'pageview' | 'cta_click';
    timeOnPage?: number;
  };

  const normalizedSlug = typeof body.slug === 'string' ? normalizeSlug(body.slug) : null;
  if (!normalizedSlug) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const timeOnPage =
    typeof body.timeOnPage === 'number' && Number.isFinite(body.timeOnPage)
      ? Math.max(0, Math.min(MAX_TIME_ON_PAGE_SEC, Math.round(body.timeOnPage)))
      : 0;

  try {
    if (body.event === 'cta_click') {
      await recordCtaClick(normalizedSlug);
    } else {
      await incrementPageview(normalizedSlug, timeOnPage);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
