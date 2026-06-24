import type { VercelRequest, VercelResponse } from '@vercel/node';

function routeKey(req: VercelRequest): string {
  const route = req.query.route;
  if (route) {
    return Array.isArray(route) ? route.join('/') : route;
  }

  const pathOnly = (req.url ?? '').split('?')[0];
  if (pathOnly.startsWith('/api/connections/')) {
    return pathOnly.slice('/api/connections/'.length);
  }

  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  const mod = await import('../../src/server/api/handlers/connections.js');

  const statusMatch = key.match(/^([^/]+)\/status$/);
  if (statusMatch) {
    return mod.handleConnectionStatus(req, res, statusMatch[1]);
  }

  if (key === 'preview') {
    return mod.handleConnectionPreview(req, res);
  }
  if (key === 'list') {
    return mod.handleConnectionList(req, res);
  }
  if (key === 'request') {
    return mod.default(req, res);
  }

  return res.status(404).json({ error: `Unknown connections route: ${key || '(empty)'}` });
}
