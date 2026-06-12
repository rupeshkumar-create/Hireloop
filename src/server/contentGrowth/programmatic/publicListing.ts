/**
 * Serve the programmatic guide library from code when Firestore is incomplete.
 */
import type { BlogPost } from '../../marketingEngine.js';
import { buildPostFromSpec, type LinkPoolEntry } from '../seed/buildPostFromSpec.js';
import { ALL_PROGRAMMATIC_SPECS } from './catalog.js';

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

export function getProgrammaticPostSummaries(
  limit = 500,
  options?: { includeScheduled?: boolean }
): Omit<BlogPost, 'content'>[] {
  const now = Date.now();
  const includeScheduled = options?.includeScheduled !== false;

  return ALL_PROGRAMMATIC_SPECS.filter((spec) => {
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
    }));
}

export function getProgrammaticPostBySlug(slug: string): BlogPost | null {
  const cached = postCache.get(slug);
  if (cached) return cached;

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
  return new Set(ALL_PROGRAMMATIC_SPECS.map((spec) => spec.slug));
}
