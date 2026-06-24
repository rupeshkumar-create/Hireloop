/**
 * Delete every Supabase auth user (profiles + related rows cascade).
 * Requires DATABASE_URL in .env (direct Postgres connection).
 */
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import './load-env.js';

const db = process.env.DATABASE_URL?.trim();
if (!db) {
  console.error('DATABASE_URL is required in .env to purge users.');
  process.exit(1);
}

const sqlFile = resolve(dirname(fileURLToPath(import.meta.url)), 'purge-all-users.sql');

try {
  execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile], {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('All users deleted.');
} catch {
  process.exit(1);
}
