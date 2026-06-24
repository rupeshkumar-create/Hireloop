/**
 * Load env for local scripts: .env.local, then .env
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(root, name);
    if (existsSync(path)) {
      config({ path, override: false });
    }
  }
}

loadEnvFiles();

export function assertSupabaseEnv(): void {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server scripts.');
  }
}
