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

function localApiVercelPlugin() {
  return {
    name: 'local-api-vercel',
    configureServer(server: any) {
      // Map routes to their local files
      const routeMap: Record<string, string> = {
        '/api/jobs': '/api/jobs/index.ts',
        '/api/openai': '/api/openai.ts',
        '/api/cron/process-user': '/api/cron/process-user.ts',
      };

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const route = Object.keys(routeMap).find(r => req.url.startsWith(r));
        if (!route) return next();

        try {
          req.body = await readJsonBody(req);
          const apiModule = await server.ssrLoadModule(routeMap[route]);
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
          console.error(`[local-api] Error in ${route}:`, message);
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
    plugins: [react(), tailwindcss(), localApiVercelPlugin()],
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
