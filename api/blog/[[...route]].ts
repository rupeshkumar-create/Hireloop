import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function routeKey(req: VercelRequest): string {
  const route = req.query.route;
  if (!route) return '';
  return Array.isArray(route) ? route.join('/') : route;
}

const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
  '': () => import('../../src/server/api/handlers/blog/index.js'),
  cover: () => import('../../src/server/api/handlers/blog/cover.js'),
  'rss.xml': () => import('../../src/server/api/handlers/blog/rss.js'),
  'seed-strategy': () => import('../../src/server/api/handlers/blog/seedStrategy.js'),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  const loader = ROUTES[key];
  if (!loader) {
    return res.status(404).json({ error: `Unknown blog route: ${key || '(empty)'}` });
  }
  const mod = await loader();
  return mod.default(req, res);
}
