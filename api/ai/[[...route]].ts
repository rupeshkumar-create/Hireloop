import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function routeKey(req: VercelRequest): string {
  const route = req.query.route;
  if (route) {
    return Array.isArray(route) ? route.join('/') : route;
  }

  // Vercel rewrites and some deploys do not populate req.query.route for catch-alls.
  const pathOnly = (req.url ?? '').split('?')[0];
  if (pathOnly.startsWith('/api/ai/')) {
    return pathOnly.slice('/api/ai/'.length);
  }
  if (pathOnly === '/api/openai') return 'openai';
  if (pathOnly === '/api/apollo') return 'apollo';

  return '';
}

const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
  openai: () => import('../../src/server/api/handlers/openai.js'),
  apollo: () => import('../../src/server/api/handlers/apollo.js'),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  const loader = ROUTES[key];
  if (!loader) {
    return res.status(404).json({ error: `Unknown AI route: ${key || '(empty)'}` });
  }
  const mod = await loader();
  return mod.default(req, res);
}
