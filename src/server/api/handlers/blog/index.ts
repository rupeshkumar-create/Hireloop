import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBlogPostBySlug, listBlogPosts } from '../../../marketingEngine.js';
import { enrichBlogPostLinks } from '../../../contentGrowth/enrichPostLinks.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';

    if (slug) {
      let post = await getBlogPostBySlug(slug);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      post = await enrichBlogPostLinks(post);

      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
      return res.status(200).json({ post });
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const posts = await listBlogPosts(limit);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
