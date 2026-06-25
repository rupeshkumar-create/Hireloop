import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer | string) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

type ApiMount = {
  prefix: string;
  module: string;
  routeParam?: boolean;
  /** Map a flat path (e.g. /api/openai) onto a catch-all sub-route */
  fixedRoute?: string;
};

const API_MOUNTS: ApiMount[] = [
  { prefix: '/api', module: '/api/index.ts', routeParam: true },
];

function localApiVercelPlugin() {
  return {
    name: 'local-api-vercel',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url?.split('?')[0] ?? '';
        const mount = API_MOUNTS.find((m) => url === m.prefix || url.startsWith(`${m.prefix}/`));
        if (!mount) return next();

        try {
          req.body = await readJsonBody(req);
          const fullUrl = new URL(req.url, 'http://localhost');
          req.query = { ...(req.query ?? {}), ...Object.fromEntries(fullUrl.searchParams.entries()) };

          if (mount.fixedRoute) {
            req.query.route = mount.fixedRoute;
          } else if (mount.routeParam) {
            const subPath = fullUrl.pathname.replace(new RegExp(`^${mount.prefix}/?`), '');
            if (subPath) req.query.route = subPath;
          }

          const apiModule = await server.ssrLoadModule(mount.module);
          const vercelLikeRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vercelLikeRes;
            },
            json(payload: unknown) {
              if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
              return vercelLikeRes;
            },
            send(payload: unknown) {
              res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
              return vercelLikeRes;
            },
          });

          await apiModule.default(req, vercelLikeRes);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[local-api] Error in ${mount.prefix}:`, message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      tailwindcss(),
      // API runs on :8000 via scripts/local-api-server.ts; Vite proxies /api in dev.
      ...(process.env.VITE_INLINE_API === 'true' ? [localApiVercelPlugin()] : []),
    ],
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: `http://localhost:${env.API_PORT || '8000'}`,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
