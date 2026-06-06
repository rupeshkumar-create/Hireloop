/**
 * GET /api/blog/cover?slug=xxx
 * Serves deterministic SVG cover — zero AI, cacheable URL for og:image.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBlogPostBySlug } from '../../../marketingEngine.js';
import { generateCoverSvg } from '../../../contentGrowth/coverImage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
  if (!slug) return res.status(400).end('slug required');

  try {
    const post = await getBlogPostBySlug(slug);
    const title = post?.title ?? 'HireSchema Hiring Guide';
    const clusterId = post?.clusterId ?? 'remote-job-search';
    const svg = generateCoverSvg(title, clusterId);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(svg);
  } catch {
    return res.status(500).end('Error generating cover');
  }
}
