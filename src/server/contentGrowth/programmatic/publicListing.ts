/**
 * Serve the programmatic guide library from code when Firestore is incomplete.
 */
import type { BlogPost } from '../../marketingEngine.js';
import { buildPostFromSpec, type LinkPoolEntry } from '../seed/buildPostFromSpec.js';
import { ALL_PROGRAMMATIC_SPECS } from './catalog.js';
import { buildWeeklyMarketBriefSpec } from '../marketBrief/buildWeeklyMarketBrief.js';
import { WEEKLY_MARKET_BRIEF_SLUG } from '../marketBrief/weeklyRolesSnapshot.js';

const LINK_POOL: LinkPoolEntry[] = ALL_PROGRAMMATIC_SPECS.map((spec) => ({
  slug: spec.slug,
  title: spec.title,
  targetKeywords: spec.targetKeywords,
  clusterId: spec.clusterId,
}));

const postCache = new Map<string, BlogPost>();
const MAX_CACHE = 48;

function estimateReadTime(spec: { directAnswer: string }): number {
  const words = spec.directAnswer.split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round(words / 40));
}

function weeklyBriefSummary(): Omit<BlogPost, 'content'> {
  const spec = buildWeeklyMarketBriefSpec();
  return {
    slug: spec.slug,
    title: spec.title,
    seoTitle: spec.seoTitle,
    seoDescription: spec.seoDescription,
    excerpt: spec.directAnswer.slice(0, 200) + '…',
    category: spec.category,
    tags: spec.tags,
    targetKeywords: spec.targetKeywords,
    readTimeMinutes: estimateReadTime(spec),
    publishedAt: spec.publishedAt,
    status: 'published' as const,
    strategyVersion: 1,
    faq: spec.faq,
    directAnswer: spec.directAnswer,
    clusterId: spec.clusterId,
    coverImageUrl: `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(spec.slug)}`,
  };
}

export function getProgrammaticPostSummaries(
  limit = 500,
  options?: { includeScheduled?: boolean }
): Omit<BlogPost, 'content'>[] {
  const now = Date.now();
  const includeScheduled = options?.includeScheduled !== false;

  const posts = ALL_PROGRAMMATIC_SPECS.filter((spec) => {
    if (includeScheduled) return true;
    return new Date(spec.publishedAt).getTime() <= now;
  })
    .slice(0, limit)
    .map((spec) => ({
      slug: spec.slug,
      title: spec.title,
      seoTitle: spec.seoTitle,
      seoDescription: spec.seoDescription,
      excerpt: spec.directAnswer.slice(0, 200) + '…',
      category: spec.category,
      tags: spec.tags,
      targetKeywords: spec.targetKeywords,
      readTimeMinutes: estimateReadTime(spec),
      publishedAt: spec.publishedAt,
      status: 'published' as const,
      strategyVersion: 1,
      faq: [],
      directAnswer: spec.directAnswer,
      clusterId: spec.clusterId,
      canonicalSlug: spec.canonicalSlug,
      coverImageUrl: `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(spec.slug)}`,
    }));

  const brief = weeklyBriefSummary();
  const withoutBrief = posts.filter((p) => p.slug !== WEEKLY_MARKET_BRIEF_SLUG);
  return [brief, ...withoutBrief].slice(0, limit + 1);
}

export function getProgrammaticPostBySlug(slug: string): BlogPost | null {
  const cached = postCache.get(slug);
  if (cached) return cached;

  if (slug === WEEKLY_MARKET_BRIEF_SLUG) {
    const spec = buildWeeklyMarketBriefSpec();
    const pool = [
      ...LINK_POOL,
      { slug: spec.slug, title: spec.title, targetKeywords: spec.targetKeywords, clusterId: spec.clusterId },
    ];
    const post = buildPostFromSpec(spec, pool);
    postCache.set(slug, post);
    return post;
  }

  const spec = ALL_PROGRAMMATIC_SPECS.find((entry) => entry.slug === slug);
  if (!spec) return null;

  const post = buildPostFromSpec(spec, LINK_POOL);
  if (postCache.size >= MAX_CACHE) {
    const oldest = postCache.keys().next().value;
    if (oldest) postCache.delete(oldest);
  }
  postCache.set(slug, post);
  return post;
}

export function getProgrammaticSlugSet(): Set<string> {
  return new Set([...ALL_PROGRAMMATIC_SPECS.map((spec) => spec.slug), WEEKLY_MARKET_BRIEF_SLUG]);
}

export function getSitemapProgrammaticSpecs() {
  const brief = buildWeeklyMarketBriefSpec();
  const catalog = ALL_PROGRAMMATIC_SPECS.filter((spec) => spec.includeInSitemap !== false);
  return [brief, ...catalog];
}
