#!/usr/bin/env npx tsx
/**
 * Write public/sitemap.xml at build time so /sitemap.xml is served as a static file
 * (avoids rewrite/catch-all 404s in Search Console).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_PROGRAMMATIC_SPECS } from '../src/server/contentGrowth/programmatic/catalog.js';

const BASE = 'https://hireschema.com';
const today = new Date().toISOString().split('T')[0]!;

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/remote-jobs', priority: '0.95', changefreq: 'weekly' },
  { loc: '/blog', priority: '0.9', changefreq: 'weekly' },
  { loc: '/login', priority: '0.5', changefreq: 'monthly' },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
  { loc: '/llms.txt', priority: '0.4', changefreq: 'weekly' },
  { loc: '/llms-full.txt', priority: '0.4', changefreq: 'weekly' },
];

const posts = ALL_PROGRAMMATIC_SPECS.filter(
  (spec) => new Date(spec.publishedAt).getTime() <= Date.now()
);

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
</urlset>
`;

const out = resolve(process.cwd(), 'public/sitemap.xml');
writeFileSync(out, xml, 'utf8');
console.log(`[generate-sitemap] Wrote public/sitemap.xml (${STATIC_PAGES.length} static + ${posts.length} blog URLs)`);
