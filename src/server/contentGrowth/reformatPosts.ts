/**
 * Batch reformat existing blog posts in Firestore.
 */
import { getAdminDb } from '../firebaseAdmin.js';
import {
  getBlogPostBySlug,
  saveBlogPost,
  type BlogPost,
} from '../marketingEngine.js';
import { reformatBlogPostContent } from '../../lib/blogContent.js';

const BLOG_COLLECTION = 'blog_posts';

export { reformatBlogPostContent } from '../../lib/blogContent.js';

export async function reformatBlogPosts(options: {
  slug?: string;
  limit?: number;
} = {}): Promise<{ reformatted: string[]; skipped: string[]; errors: { slug: string; error: string }[] }> {
  const db = getAdminDb();
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
    const limit = Math.min(options.limit ?? 100, 200);
    const snap = await db.collection(BLOG_COLLECTION).limit(limit).get();
    posts = snap.docs.map((d) => d.data() as BlogPost);
  }

  for (const post of posts) {
    if (!post.slug || !post.content?.trim()) {
      skipped.push(post.slug ?? '(unknown)');
      continue;
    }
    try {
      const patch = reformatBlogPostContent(post);
      await saveBlogPost({ ...post, ...patch });
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
