import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBlogPostBySlug } from '../../src/server/marketingEngine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const slug = req.query.slug as string;
  if (!slug) return res.status(400).json({ error: 'Missing slug parameter' });

  try {
    const post = await getBlogPostBySlug(slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
