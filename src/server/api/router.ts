import type { IncomingMessage } from 'http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

export function apiRouteKey(req: VercelRequest): string {
  const route = req.query.route;
  if (route) {
    return Array.isArray(route) ? route.join('/') : route;
  }

  const pathOnly = (req.url ?? '').split('?')[0];
  if (pathOnly.startsWith('/api/')) {
    return pathOnly.slice('/api/'.length).replace(/\/$/, '');
  }

  return '';
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Parse JSON body when Vercel bodyParser is disabled (webhook routes need raw bytes). */
async function ensureJsonBody(req: VercelRequest): Promise<void> {
  if (req.body !== undefined) return;

  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    req.body = {};
    return;
  }

  const raw = await readRawBody(req);
  if (!raw.trim()) {
    req.body = {};
    return;
  }

  try {
    req.body = JSON.parse(raw);
  } catch {
    req.body = raw;
  }
}

async function dispatchCron(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const job = key.startsWith('cron/') ? key.slice('cron/'.length) : key === 'cron' ? 'tick' : '';
  if (!job) return false;

  const JOBS: Record<string, () => Promise<{ default: Handler }>> = {
    tick: () => import('./handlers/cron/tick.js'),
    'daily-alerts': () => import('./handlers/cron/dailyAlerts.js'),
    'process-user': () => import('./handlers/cron/processUser.js'),
  };

  const loader = JOBS[job];
  if (!loader) {
    res.status(404).json({ error: `Unknown cron job: ${job}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchAi(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  let aiKey = '';
  if (key === 'openai' || key === 'ai/openai') aiKey = 'openai';
  else if (key === 'apollo' || key === 'ai/apollo') aiKey = 'apollo';
  else if (key.startsWith('ai/')) aiKey = key.slice('ai/'.length);
  if (!aiKey) return false;

  const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
    openai: () => import('./handlers/openai.js'),
    apollo: () => import('./handlers/apollo.js'),
  };

  const loader = ROUTES[aiKey];
  if (!loader) {
    res.status(404).json({ error: `Unknown AI route: ${aiKey}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchBlog(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (key !== 'blog' && !key.startsWith('blog/')) return false;

  const sub = key === 'blog' ? '' : key.slice('blog/'.length);
  const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
    '': () => import('./handlers/blog/index.js'),
    cover: () => import('./handlers/blog/cover.js'),
    'rss.xml': () => import('./handlers/blog/rss.js'),
    'seed-strategy': () => import('./handlers/blog/seedStrategy.js'),
    'seed-evergreen': () => import('./handlers/blog/seedEvergreen.js'),
  };

  const loader = ROUTES[sub];
  if (!loader) {
    res.status(404).json({ error: `Unknown blog route: ${sub || '(empty)'}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchAdmin(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!key.startsWith('admin/')) return false;

  const sub = key.slice('admin/'.length);
  const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
    users: () => import('./handlers/admin/users.js'),
    'ghost-discover': () => import('./handlers/admin/ghostDiscover.js'),
    bootstrap: () => import('./handlers/admin/bootstrap.js'),
  };

  const loader = ROUTES[sub];
  if (!loader) {
    res.status(404).json({ error: `Unknown admin route: ${sub || '(empty)'}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchPublic(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!key.startsWith('public/')) return false;

  const sub = key.slice('public/'.length);
  const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
    sitemap: () => import('./handlers/sitemap.js'),
    'bing-site-auth': () => import('./handlers/bingSiteAuth.js'),
    'analytics/pageview': () => import('./handlers/analyticsPageview.js'),
  };

  const loader = ROUTES[sub];
  if (!loader) {
    res.status(404).json({ error: `Unknown public route: ${sub || '(empty)'}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchApify(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!key.startsWith('apify/')) return false;

  const sub = key.slice('apify/'.length);
  const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
    recruiter: () =>
      import('./handlers/apifyPeople.js').then((m) => ({ default: m.handleRecruiterLookup })),
    'linkedin-profile': () =>
      import('./handlers/apifyPeople.js').then((m) => ({ default: m.handleLinkedInProfile })),
  };

  const loader = ROUTES[sub];
  if (!loader) {
    res.status(404).json({ error: `Unknown Apify route: ${sub || '(empty)'}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchConnections(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!key.startsWith('connections/')) return false;

  const sub = key.slice('connections/'.length);
  const mod = await import('./handlers/connections.js');

  const statusMatch = sub.match(/^([^/]+)\/status$/);
  if (statusMatch) {
    await mod.handleConnectionStatus(req, res, statusMatch[1]);
    return true;
  }

  if (sub === 'preview') {
    await mod.handleConnectionPreview(req, res);
    return true;
  }
  if (sub === 'list') {
    await mod.handleConnectionList(req, res);
    return true;
  }
  if (sub === 'request') {
    await mod.default(req, res);
    return true;
  }

  res.status(404).json({ error: `Unknown connections route: ${sub || '(empty)'}` });
  return true;
}

async function dispatchStorage(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!key.startsWith('storage/')) return false;

  const sub = key.slice('storage/'.length);
  const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
    'resume-upload-url': () =>
      import('./handlers/storage.js').then((m) => ({ default: m.handleResumeUploadUrl })),
    'resume-download-url': () =>
      import('./handlers/storage.js').then((m) => ({ default: m.handleResumeDownloadUrl })),
  };

  const loader = ROUTES[sub];
  if (!loader) {
    res.status(404).json({ error: `Unknown storage route: ${sub || '(empty)'}` });
    return true;
  }

  const mod = await loader();
  await mod.default(req, res);
  return true;
}

async function dispatchChat(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (key !== 'chat' && !key.startsWith('chat/')) return false;

  const sub = key === 'chat' ? 'message' : key.slice('chat/'.length);
  if (sub !== 'message') {
    res.status(404).json({ error: `Unknown chat route: ${sub || '(empty)'}` });
    return true;
  }

  const mod = await import('./handlers/chat.js');
  await mod.default(req, res);
  return true;
}

async function dispatchJill(key: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!key.startsWith('jill/')) return false;

  const sub = key.slice('jill/'.length);
  const mod = await import('./handlers/jill.js');
  req.query = { ...req.query, route: sub };
  await mod.default(req, res);
  return true;
}

export async function routeApiRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
  const key = apiRouteKey(req);

  if (key === 'webhook/dodo') {
    const mod = await import('./handlers/webhookDodo.js');
    await mod.default(req, res);
    return;
  }

  await ensureJsonBody(req);

  if (key === 'jobs') {
    const mod = await import('./handlers/jobs.js');
    await mod.default(req, res);
    return;
  }

  if (key.startsWith('cron/') || key === 'cron') {
    if (await dispatchCron(key, req, res)) return;
  }

  if (await dispatchAi(key, req, res)) return;
  if (await dispatchBlog(key, req, res)) return;
  if (await dispatchAdmin(key, req, res)) return;
  if (await dispatchPublic(key, req, res)) return;
  if (await dispatchApify(key, req, res)) return;
  if (await dispatchConnections(key, req, res)) return;
  if (await dispatchStorage(key, req, res)) return;
  if (await dispatchChat(key, req, res)) return;
  if (await dispatchJill(key, req, res)) return;

  res.status(404).json({ error: `Unknown API route: ${key || '(empty)'}` });
}
