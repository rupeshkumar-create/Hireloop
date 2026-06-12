/**
 * GET /api/sitemap.xml — Auto-generated sitemap for blog posts and core pages.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listBlogPosts } from '../../marketingEngine.js';
import { ensureDailyBlogPublish } from '../../contentGrowth/ensureDailyPublish.js';

const BASE = 'https://hireschema.com';
const SITEMAP_POST_LIMIT = 500;

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/remote-jobs', priority: '0.95', changefreq: 'weekly' },
  { loc: '/blog', priority: '0.9', changefreq: 'daily' },
  { loc: '/login', priority: '0.5', changefreq: 'monthly' },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
  { loc: '/llms.txt', priority: '0.4', changefreq: 'weekly' },
  { loc: '/llms-full.txt', priority: '0.4', changefreq: 'weekly' },
];

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const posts = await listBlogPosts(SITEMAP_POST_LIMIT, { includeScheduled: false });
    void ensureDailyBlogPublish('sitemap', { posts }).catch((error) => {
      console.error('[sitemap] ensureDailyBlogPublish failed:', error);
    });
    const today = new Date().toISOString().split('T')[0];

    const urls = [
      ...STATIC_PAGES.map(
        (p) => `  <url>
    <loc>${BASE}${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
      ),
      ...posts.map(
        (p) => `  <url>
    <loc>${BASE}/blog/${p.slug}</loc>
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
