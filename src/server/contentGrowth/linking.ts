/**
 * Bidirectional internal linking — updates older posts to link back to new content.
 * Zero AI calls.
 */

import { getDoc, setDoc, queryDocs } from '../db/docStore.js';
import type { BlogPost } from '../marketingEngine.js';
import type { InternalLink } from '../../types/contentGrowth.js';

const BLOG_COLLECTION = 'blog_posts';

/** Score and pick related posts for internal linking. */
export function buildInternalLinks(
  newPost: { slug: string; title: string; targetKeywords: string[]; clusterId: string },
  existingPosts: { slug: string; title: string; targetKeywords: string[]; clusterId?: string }[]
): InternalLink[] {
  const scored = existingPosts
    .filter((p) => p.slug !== newPost.slug)
    .map((p) => {
      const keywordOverlap = p.targetKeywords.filter((k) =>
        newPost.targetKeywords.some(
          (nk) =>
            nk.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(nk.toLowerCase())
        )
      ).length;
      const clusterBonus = p.clusterId === newPost.clusterId ? 3 : 0;
      return {
        slug: p.slug,
        title: p.title,
        anchorText: p.title.split(':')[0].slice(0, 60),
        relevanceScore: keywordOverlap * 2 + clusterBonus,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const relevant = scored.filter((l) => l.relevanceScore > 0).slice(0, 5);
  if (relevant.length >= 2) return relevant;

  const clusterMatches = scored.filter((l) => l.relevanceScore >= 3).slice(0, 3);
  const recent = existingPosts
    .filter((p) => p.slug !== newPost.slug)
    .slice(0, 4)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      anchorText: p.title.split(':')[0].slice(0, 60),
      relevanceScore: 1,
    }));

  const merged = [...clusterMatches, ...recent];
  const seen = new Set<string>();
  return merged
    .filter((l) => {
      if (seen.has(l.slug)) return false;
      seen.add(l.slug);
      return true;
    })
    .slice(0, 4);
}

/** Inject a Related Hiring Guides markdown section before FAQ. */
export function injectInternalLinks(content: string, links: InternalLink[]): string {
  if (links.length === 0) return content;

  const relatedSection = [
    '',
    '## Related Hiring Guides',
    '',
    ...links.map((l) => `- [${l.anchorText}](/blog/${l.slug})`),
    '',
  ].join('\n');

  const faqIndex = content.search(/###\s+FAQ/i);
  if (faqIndex > 0) {
    return content.slice(0, faqIndex) + relatedSection + content.slice(faqIndex);
  }
  return content + relatedSection;
}

export function extractInternalLinksFromMarkdown(content: string): InternalLink[] {
  const start = content.search(/##\s+Related Hiring Guides/i);
  if (start < 0) return [];

  const tail = content.slice(start);
  const nextHeading = tail.search(/\n##\s+(?!Related Hiring Guides)/i);
  const faqStart = tail.search(/\n###\s+FAQ/i);
  const end =
    nextHeading > 0 && faqStart > 0
      ? Math.min(nextHeading, faqStart)
      : nextHeading > 0
        ? nextHeading
        : faqStart > 0
          ? faqStart
          : tail.length;
  const section = tail.slice(0, end);

  const links: InternalLink[] = [];
  const linkRegex = /\[([^\]]+)\]\(\/blog\/([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(section)) !== null) {
    links.push({
      slug: match[2].trim(),
      title: match[1].trim(),
      anchorText: match[1].trim(),
      relevanceScore: 1,
    });
  }
  return links;
}

export function contentHasRelatedSection(content: string): boolean {
  return /##\s+Related Hiring Guides/i.test(content);
}

export function ensurePostLinkFields(
  post: Pick<BlogPost, 'slug' | 'title' | 'content' | 'targetKeywords' | 'tags' | 'clusterId' | 'internalLinks'>,
  catalog: { slug: string; title: string; targetKeywords: string[]; clusterId?: string; tags?: string[] }[]
): Pick<BlogPost, 'content' | 'internalLinks'> & BlogPost {
  let internalLinks =
    post.internalLinks && post.internalLinks.length > 0
      ? post.internalLinks
      : extractInternalLinksFromMarkdown(post.content);

  if (internalLinks.length === 0) {
    internalLinks = buildInternalLinks(
      {
        slug: post.slug,
        title: post.title,
        targetKeywords: post.targetKeywords?.length ? post.targetKeywords : (post.tags ?? []),
        clusterId: post.clusterId ?? 'remote-job-search',
      },
      catalog
        .filter((p) => p.slug !== post.slug)
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          targetKeywords: p.targetKeywords?.length ? p.targetKeywords : (p.tags ?? []),
          clusterId: p.clusterId,
        }))
    );
  }

  let content = post.content;
  if (internalLinks.length > 0 && !contentHasRelatedSection(content)) {
    content = injectInternalLinks(content, internalLinks);
  }

  return { ...(post as BlogPost), internalLinks, content };
}

export async function applyBidirectionalLinks(
  newPost: { slug: string; title: string; anchorText: string; clusterId: string },
  relatedSlugs: string[]
): Promise<number> {
  if (relatedSlugs.length === 0) return 0;

  let updated = 0;

  for (const oldSlug of relatedSlugs.slice(0, 4)) {
    if (oldSlug === newPost.slug) continue;
    const doc = await getDoc(BLOG_COLLECTION, oldSlug);
    if (!doc.data) continue;

    const data = doc.data as BlogPost & { internalLinks?: InternalLink[] };
    const existing = data.internalLinks ?? [];
    if (existing.some((l) => l.slug === newPost.slug)) continue;

    const newLink: InternalLink = {
      slug: newPost.slug,
      title: newPost.title,
      anchorText: newPost.title.split(':')[0].slice(0, 60),
      relevanceScore: 5,
    };

    await setDoc(BLOG_COLLECTION, oldSlug, {
      internalLinks: [...existing, newLink].slice(-6),
      updatedAt: new Date().toISOString(),
    }, true);
    updated++;
  }

  return updated;
}

export function isDuplicateTopic(
  title: string,
  slug: string,
  existing: { title: string; slug: string }[]
): { isDuplicate: boolean; reason?: string } {
  const normTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normSlug = slug.toLowerCase();

  for (const post of existing) {
    const existingNorm = post.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (existingNorm === normTitle) {
      return { isDuplicate: true, reason: `Duplicate title: "${post.title}"` };
    }
    if (post.slug === normSlug) {
      return { isDuplicate: true, reason: `Duplicate slug: "${post.slug}"` };
    }
    // Fuzzy: 80% word overlap
    const wordsA = new Set(normTitle.split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(existingNorm.split(/\s+/).filter((w) => w.length > 3));
    if (wordsA.size > 0 && wordsB.size > 0) {
      const overlap = [...wordsA].filter((w) => wordsB.has(w)).length;
      const similarity = overlap / Math.max(wordsA.size, wordsB.size);
      if (similarity > 0.8) {
        return { isDuplicate: true, reason: `Similar to "${post.title}" (${Math.round(similarity * 100)}% overlap)` };
      }
    }
  }
  return { isDuplicate: false };
}
