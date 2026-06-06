import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function routeKey(req: VercelRequest): string {
  const route = req.query.route;
  if (!route) return '';
  return Array.isArray(route) ? route.join('/') : route;
}

const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
  sitemap: () => import('../../src/server/api/handlers/sitemap.js'),
  'analytics/pageview': () => import('../../src/server/api/handlers/analyticsPageview.js'),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  const loader = ROUTES[key];
  if (!loader) {
    return res.status(404).json({ error: `Unknown public route: ${key || '(empty)'}` });
  }
  const mod = await loader();
  return mod.default(req, res);
}
