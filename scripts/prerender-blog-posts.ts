#!/usr/bin/env npx tsx
/**
 * After Vite build, write static HTML for each blog post so crawlers get full content
 * without executing JavaScript. Vercel serves dist/blog/{slug}/index.html before SPA fallback.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { getSitemapProgrammaticSpecs } from '../src/server/contentGrowth/programmatic/publicListing.js';
import { getProgrammaticPostBySlug } from '../src/server/contentGrowth/programmatic/publicListing.js';
import { buildBlogPostHtml, buildBlogIndexHtml } from './lib/blogPrerenderHtml.js';

const dist = resolve(process.cwd(), 'dist');
const now = Date.now();

const published = getSitemapProgrammaticSpecs().filter(
  (spec) => new Date(spec.publishedAt).getTime() <= now
);

let written = 0;
let skipped = 0;

for (const spec of published) {
  try {
    const post = getProgrammaticPostBySlug(spec.slug);
    if (!post) {
      skipped++;
      continue;
    }
    const html = buildBlogPostHtml(post);
    const outDir = resolve(dist, 'blog', spec.slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), html, 'utf8');
    written++;
  } catch (err) {
    skipped++;
    console.warn(`[prerender-blog] skip ${spec.slug}:`, err instanceof Error ? err.message : err);
  }
}

const indexPosts = published
  .slice()
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  .map((s) => ({
    slug: s.slug,
    title: s.title,
    category: s.category,
    publishedAt: s.publishedAt,
  }));

const blogIndexDir = resolve(dist, 'blog');
mkdirSync(blogIndexDir, { recursive: true });
writeFileSync(resolve(blogIndexDir, 'index.html'), buildBlogIndexHtml(indexPosts), 'utf8');

console.log(
  `[prerender-blog] Wrote dist/blog/index.html + ${written} post pages (${skipped} skipped)`
);
