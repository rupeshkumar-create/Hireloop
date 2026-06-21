/**
 * GET /api/sitemap.xml — Auto-generated sitemap for blog posts and core pages.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listBlogPosts } from '../../marketingEngine.js';
import { SITEMAP_BASE_URL, SITEMAP_STATIC_PAGES } from '../../../lib/sitemapPages.js';

const SITEMAP_POST_LIMIT = 500;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const posts = await listBlogPosts(SITEMAP_POST_LIMIT, { includeScheduled: false });
    const today = new Date().toISOString().split('T')[0];

    const urls = [
      ...SITEMAP_STATIC_PAGES.map(
        (p) => `  <url>
    <loc>${SITEMAP_BASE_URL}${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
      ),
      ...posts.map(
        (p) => `  <url>
    <loc>${SITEMAP_BASE_URL}/blog/${p.slug}</loc>
    <lastmod>${(p.publishedAt || today).split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).send(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
