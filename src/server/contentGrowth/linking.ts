/**
 * Bidirectional internal linking — updates older posts to link back to new content.
 * Zero AI calls.
 */

import { getAdminDb } from '../firebaseAdmin.js';
import type { BlogPost } from '../marketingEngine.js';
import type { InternalLink } from '../../types/contentGrowth.js';

const BLOG_COLLECTION = 'blog_posts';

export async function applyBidirectionalLinks(
  newPost: { slug: string; title: string; anchorText: string; clusterId: string },
  relatedSlugs: string[]
): Promise<number> {
  if (relatedSlugs.length === 0) return 0;

  const db = getAdminDb();
  let updated = 0;

  for (const oldSlug of relatedSlugs.slice(0, 4)) {
    if (oldSlug === newPost.slug) continue;
    const ref = db.collection(BLOG_COLLECTION).doc(oldSlug);
    const doc = await ref.get();
    if (!doc.exists) continue;

    const data = doc.data() as BlogPost & { internalLinks?: InternalLink[] };
    const existing = data.internalLinks ?? [];
    if (existing.some((l) => l.slug === newPost.slug)) continue;

    const newLink: InternalLink = {
      slug: newPost.slug,
      title: newPost.title,
      anchorText: newPost.title.split(':')[0].slice(0, 60),
      relevanceScore: 5,
    };

    await ref.update({
      internalLinks: [...existing, newLink].slice(-6),
      updatedAt: new Date().toISOString(),
    });
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
