import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function routeKey(req: VercelRequest): string {
  const route = req.query.route;
  if (route) {
    return Array.isArray(route) ? route.join('/') : route;
  }
  const pathOnly = (req.url ?? '').split('?')[0];
  if (pathOnly.startsWith('/api/jill/')) {
    return pathOnly.slice('/api/jill/'.length);
  }
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  const mod = await import('../../src/server/api/handlers/jill.js');
  req.query = { ...req.query, route: key };
  return mod.default(req, res);
}
