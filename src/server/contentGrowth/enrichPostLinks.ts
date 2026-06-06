/**
 * Ensure every blog post has internal links in metadata and markdown.
 */
import { getAdminDb } from '../firebaseAdmin.js';
import {
  getBlogPostBySlug,
  listBlogPosts,
  saveBlogPost,
  type BlogPost,
} from '../marketingEngine.js';
import {
  buildInternalLinks,
  contentHasRelatedSection,
  ensurePostLinkFields,
  extractInternalLinksFromMarkdown,
} from './linking.js';

export type PostLinkCatalogEntry = {
  slug: string;
  title: string;
  targetKeywords: string[];
  clusterId?: string;
  tags?: string[];
};

function keywordsFor(entry: PostLinkCatalogEntry): string[] {
  if (entry.targetKeywords?.length) return entry.targetKeywords;
  return entry.tags ?? [];
}

export function buildInternalLinksForPost(
  post: Pick<BlogPost, 'slug' | 'title' | 'targetKeywords' | 'tags' | 'clusterId'>,
  catalog: PostLinkCatalogEntry[]
): ReturnType<typeof buildInternalLinks> {
  return buildInternalLinks(
    {
      slug: post.slug,
      title: post.title,
      targetKeywords: keywordsFor(post),
      clusterId: post.clusterId ?? 'remote-job-search',
    },
    catalog
      .filter((p) => p.slug !== post.slug)
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        targetKeywords: keywordsFor(p),
        clusterId: p.clusterId,
      }))
  );
}

export { contentHasRelatedSection, extractInternalLinksFromMarkdown, ensurePostLinkFields };

export async function loadPostLinkCatalog(limit = 100): Promise<PostLinkCatalogEntry[]> {
  const posts = await listBlogPosts(limit);
  return posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    targetKeywords: p.targetKeywords ?? [],
    clusterId: p.clusterId,
    tags: p.tags,
  }));
}

export async function enrichBlogPostLinks(post: BlogPost): Promise<BlogPost> {
  const catalog = await loadPostLinkCatalog(100);
  if (catalog.length <= 1) return post;
  return ensurePostLinkFields(post, catalog);
}

export async function backfillAllPostInternalLinks(options: {
  slug?: string;
  limit?: number;
} = {}): Promise<{ updated: string[]; skipped: string[]; errors: { slug: string; error: string }[] }> {
  const catalog = await loadPostLinkCatalog(100);
  const updated: string[] = [];
  const skipped: string[] = [];
  const errors: { slug: string; error: string }[] = [];

  let posts: BlogPost[] = [];

  if (options.slug) {
    const post = await getBlogPostBySlug(options.slug);
    if (!post) return { updated, skipped, errors: [{ slug: options.slug, error: 'Post not found' }] };
    posts = [post];
  } else {
    const db = getAdminDb();
    const snap = await db.collection('blog_posts').limit(Math.min(options.limit ?? 100, 200)).get();
    posts = snap.docs.map((d) => d.data() as BlogPost);
  }

  if (catalog.length <= 1) {
    return { updated, skipped: posts.map((p) => p.slug), errors: [] };
  }

  for (const post of posts) {
    if (!post.slug || !post.content?.trim()) {
      skipped.push(post.slug ?? '(unknown)');
      continue;
    }
    try {
      const enriched = ensurePostLinkFields(post, catalog);
      const hadLinks = (post.internalLinks?.length ?? 0) > 0;
      const hadSection = contentHasRelatedSection(post.content);
      const changed =
        enriched.content !== post.content ||
        (enriched.internalLinks?.length ?? 0) !== (post.internalLinks?.length ?? 0);

      if (!changed && hadLinks && hadSection) {
        skipped.push(post.slug);
        continue;
      }

      await saveBlogPost({
        ...enriched,
        refreshedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      updated.push(post.slug);
    } catch (err) {
      errors.push({
        slug: post.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { updated, skipped, errors };
}
