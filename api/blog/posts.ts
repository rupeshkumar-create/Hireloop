import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listBlogPosts } from '../_lib/marketingEngine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const posts = await listBlogPosts(limit);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
