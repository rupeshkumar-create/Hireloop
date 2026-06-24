/**
 * Start API (8000) + Vite (3001) together for local development.
 */
import './load-env.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const children: ReturnType<typeof spawn>[] = [];

function run(command: string, args: string[], label: string) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[dev] ${label} stopped (${signal})`);
    } else if (code && code !== 0) {
      console.error(`[dev] ${label} exited with code ${code}`);
    }
    shutdown();
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('npx', ['tsx', 'scripts/local-api-server.ts'], 'api');
setTimeout(() => {
  run('npx', ['vite', '--port=3001', '--host=0.0.0.0'], 'vite');
}, 400);
