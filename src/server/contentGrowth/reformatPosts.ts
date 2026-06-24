/**
 * Batch reformat existing blog posts in Firestore.
 */
import { queryDocs } from '../db/docStore.js';
import {
  getBlogPostBySlug,
  saveBlogPost,
  type BlogPost,
} from '../marketingEngine.js';
import { reformatBlogPostContent } from '../../lib/blogContent.js';
import { ensurePostLinkFields, loadPostLinkCatalog, BLOG_LINK_CATALOG_LIMIT, BLOG_BACKFILL_LIMIT } from './enrichPostLinks.js';

const BLOG_COLLECTION = 'blog_posts';

export { reformatBlogPostContent } from '../../lib/blogContent.js';

export async function reformatBlogPosts(options: {
  slug?: string;
  limit?: number;
} = {}): Promise<{ reformatted: string[]; skipped: string[]; errors: { slug: string; error: string }[] }> {
  const reformatted: string[] = [];
  const skipped: string[] = [];
  const errors: { slug: string; error: string }[] = [];

  let posts: BlogPost[] = [];

  if (options.slug) {
    const post = await getBlogPostBySlug(options.slug);
    if (!post) {
      return { reformatted, skipped, errors: [{ slug: options.slug, error: 'Post not found' }] };
    }
    posts = [post];
  } else {
    const limit = Math.min(options.limit ?? BLOG_BACKFILL_LIMIT, BLOG_BACKFILL_LIMIT);
    const docs = await queryDocs(BLOG_COLLECTION, { limit });
    posts = docs.map((d) => d.data as BlogPost);
  }

  if (posts.length === 0) {
    return { reformatted, skipped, errors };
  }

  const catalog = await loadPostLinkCatalog(BLOG_LINK_CATALOG_LIMIT);

  for (const post of posts) {
    if (!post.slug || !post.content?.trim()) {
      skipped.push(post.slug ?? '(unknown)');
      continue;
    }
    try {
      const patch = reformatBlogPostContent(post);
      const updated = ensurePostLinkFields({ ...post, ...patch }, catalog);
      await saveBlogPost(updated);
      reformatted.push(post.slug);
    } catch (err) {
      errors.push({
        slug: post.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { reformatted, skipped, errors };
}
