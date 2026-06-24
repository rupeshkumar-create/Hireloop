import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function routeKey(req: VercelRequest): string {
  const route = req.query.route;
  if (route) {
    return Array.isArray(route) ? route.join('/') : route;
  }

  const pathOnly = (req.url ?? '').split('?')[0];
  if (pathOnly.startsWith('/api/apify/')) {
    return pathOnly.slice('/api/apify/'.length);
  }

  return '';
}

const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
  recruiter: () => import('../../src/server/api/handlers/apifyPeople.js').then((m) => ({ default: m.handleRecruiterLookup })),
  'linkedin-profile': () =>
    import('../../src/server/api/handlers/apifyPeople.js').then((m) => ({ default: m.handleLinkedInProfile })),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = routeKey(req);
  const loader = ROUTES[key];
  if (!loader) {
    return res.status(404).json({ error: `Unknown Apify route: ${key || '(empty)'}` });
  }
  const mod = await loader();
  return mod.default(req, res);
}
