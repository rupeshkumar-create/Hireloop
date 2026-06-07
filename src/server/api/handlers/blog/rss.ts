/**
 * GET /api/blog/rss.xml — RSS feed for hiring guides (distribution + crawlers).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listBlogPosts } from '../../../marketingEngine.js';
import { ensureDailyBlogPublish } from '../../../contentGrowth/ensureDailyPublish.js';

const BASE = 'https://hireschema.com';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const posts = await listBlogPosts(50);
    void ensureDailyBlogPublish('rss', { posts }).catch((error) => {
      console.error('[rss] ensureDailyBlogPublish failed:', error);
    });
    const items = posts
      .map(
        (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${BASE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${p.slug}</guid>
      <description>${escapeXml(p.seoDescription || p.excerpt || '')}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(p.category)}</category>
    </item>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HireSchema Hiring Guides</title>
    <link>${BASE}/blog</link>
    <description>Daily recruiter-focused hiring guides on remote job search, AI matching, salary data, and interview prep.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
