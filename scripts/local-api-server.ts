/**
 * Local API server — mirrors Vite's in-process API middleware on port 8000.
 */
import './load-env.js';
import { assertSupabaseEnv } from './load-env.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  assertSupabaseEnv();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[local-api] ${message}`);
  console.error(
    'Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase Dashboard → Project Settings → API → service_role secret).\n'
  );
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = Number(process.env.API_PORT) || 8000;

type ApiMount = {
  prefix: string;
  module: string;
  routeParam?: boolean;
  fixedRoute?: string;
};

const API_MOUNTS: ApiMount[] = [
  { prefix: '/api', module: '/api/index.ts', routeParam: true },
];

function vercelLikeRes(res: express.Response) {
  const out = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return out;
    },
    json(payload: unknown) {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
      return out;
    },
    send(payload: unknown) {
      if (typeof payload === 'string' && !res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'text/plain');
      }
      res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return out;
    },
  });
  return out;
}

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.text({ type: ['text/*', 'application/xml', 'application/rss+xml'], limit: '2mb' }));

app.use(async (req, res, next) => {
  const pathname = req.path;
  const mount = API_MOUNTS.find((m) => pathname === m.prefix || pathname.startsWith(`${m.prefix}/`));
  if (!mount) return next();

  try {
    const fullUrl = new URL(req.originalUrl, `http://localhost:${PORT}`);
    const query: Record<string, string | string[]> = {
      ...Object.fromEntries(
        Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : String(v ?? '')])
      ),
    };

    if (mount.fixedRoute) {
      query.route = mount.fixedRoute;
    } else if (mount.routeParam) {
      const subPath = pathname.replace(new RegExp(`^${mount.prefix}/?`), '');
      if (subPath) query.route = subPath;
    }

    const vercelReq = Object.assign(req, {
      query,
      body: req.body,
      url: req.originalUrl,
    });

    const modulePath = path.join(root, mount.module);
    const apiModule = await import(modulePath);
    await apiModule.default(vercelReq, vercelLikeRes(res));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[local-api] Error in ${pathname}:`, message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server ready at http://localhost:${PORT}`);
});
