/**
 * Serve evergreen guides from code when Firestore has no posts yet.
 * Ensures /blog works immediately; seedEvergreenPosts() persists to Firestore for admin.
 */
import type { BlogPost } from '../../marketingEngine.js';
import { buildInternalLinks, injectInternalLinks } from '../linking.js';
import { EVERGREEN_SPECS } from './catalog.js';
import { buildEvergreenMarkdown, extractFaqFromMarkdown } from './buildArticle.js';

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));
}

function evergreenCatalog() {
  return EVERGREEN_SPECS.map((s) => ({
    slug: s.slug,
    title: s.title,
    targetKeywords: s.targetKeywords,
    clusterId: s.clusterId,
    tags: s.tags,
  }));
}

function buildPostFromSpec(spec: (typeof EVERGREEN_SPECS)[number]): BlogPost {
  const catalog = evergreenCatalog().filter((s) => s.slug !== spec.slug);
  const internalLinks = buildInternalLinks(
    {
      slug: spec.slug,
      title: spec.title,
      targetKeywords: spec.targetKeywords,
      clusterId: spec.clusterId,
    },
    catalog
  );
  const content = injectInternalLinks(buildEvergreenMarkdown(spec), internalLinks);
  const faq = extractFaqFromMarkdown(content);
  return {
    slug: spec.slug,
    title: spec.title,
    seoTitle: spec.seoTitle,
    seoDescription: spec.seoDescription,
    excerpt: spec.directAnswer.slice(0, 200) + '…',
    content,
    category: spec.category,
    tags: spec.tags,
    targetKeywords: spec.targetKeywords,
    readTimeMinutes: estimateReadTime(content),
    publishedAt: spec.publishedAt,
    status: 'published',
    strategyVersion: 1,
    faq,
    directAnswer: spec.directAnswer,
    clusterId: spec.clusterId,
    internalLinks,
    coverImageUrl: `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(spec.slug)}`,
  };
}

export function getEvergreenPostSummaries(limit = 50): Omit<BlogPost, 'content'>[] {
  return EVERGREEN_SPECS.slice(0, limit).map((spec) => {
    const post = buildPostFromSpec(spec);
    const { content: _content, ...rest } = post;
    void _content;
    return rest;
  });
}

export function getEvergreenPostBySlug(slug: string): BlogPost | null {
  const spec = EVERGREEN_SPECS.find((s) => s.slug === slug);
  if (!spec) return null;
  return buildPostFromSpec(spec);
}

export function getEvergreenSlugSet(): Set<string> {
  return new Set(EVERGREEN_SPECS.map((s) => s.slug));
}
