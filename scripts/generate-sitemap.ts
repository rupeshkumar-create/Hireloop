#!/usr/bin/env npx tsx
/**
 * Write public/sitemap.xml at build time so /sitemap.xml is served as a static file
 * (avoids rewrite/catch-all 404s in Search Console).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSitemapProgrammaticSpecs } from '../src/server/contentGrowth/programmatic/publicListing.js';
import { SITEMAP_BASE_URL, SITEMAP_STATIC_PAGES } from '../src/lib/sitemapPages.js';

const today = new Date().toISOString().split('T')[0]!;

const posts = getSitemapProgrammaticSpecs().filter(
  (spec) => new Date(spec.publishedAt).getTime() <= Date.now()
);

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
    <changefreq>${p.slug === 'weekly-top-remote-roles' ? 'daily' : 'weekly'}</changefreq>
    <priority>${p.slug === 'weekly-top-remote-roles' ? '0.9' : '0.8'}</priority>
  </url>`
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

const out = resolve(process.cwd(), 'public/sitemap.xml');
writeFileSync(out, xml, 'utf8');
console.log(`[generate-sitemap] Wrote public/sitemap.xml (${SITEMAP_STATIC_PAGES.length} static + ${posts.length} blog URLs)`);
