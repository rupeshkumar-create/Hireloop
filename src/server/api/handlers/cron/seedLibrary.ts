/**
 * /api/cron/seed-library
 *
 * Seeds programmatic blog posts in batches (use offset + limit to avoid timeout).
 * Auth: CRON_SECRET header or ?secret=
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireCronSecret } from '../../../cronAuth.js';
import { seedProgrammaticLibrary } from '../../../contentGrowth/seedProgrammaticLibrary.js';
import { backfillAllPostInternalLinks } from '../../../contentGrowth/enrichPostLinks.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireCronSecret(req, res)) return;

  try {
    const offset = Number(req.query.offset ?? req.body?.offset ?? 0);
    const limit = Number(req.query.limit ?? req.body?.limit ?? 50);
    const force = req.query.force === 'true' || req.body?.force === true;
    const backfill = req.query.backfill === 'true' || req.body?.backfill === true;

    const result = await seedProgrammaticLibrary({
      force,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    let backfillResult: { updated: string[] } | undefined;
    if (backfill) {
      backfillResult = await backfillAllPostInternalLinks({ limit: 500 });
    }

    return res.status(200).json({
      success: true,
      ...result,
      backfillUpdated: backfillResult?.updated.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[seed-library] Failed:', message);
    return res.status(500).json({ error: message });
  }
}
