/**
 * Load env for local scripts: .env.vercel.local, .env.local, .env
 * Does NOT override variables already set (e.g. by `vercel env run`).
 */
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FALLBACK_FIRESTORE_DATABASE_ID } from '../src/lib/firebaseProjectDefaults.js';

const PLACEHOLDER = /your_|\.{3}|example|placeholder/i;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFiles() {
  for (const name of ['.env.vercel.local', '.env.local', '.env']) {
    const path = resolve(root, name);
    if (existsSync(path)) {
      // Never override — `vercel env run` injects real secrets into process.env
      config({ path, override: false });
    }
  }

  const dbId = process.env.FIRESTORE_DATABASE_ID?.trim() ?? '';
  if (!dbId || PLACEHOLDER.test(dbId)) {
    process.env.FIRESTORE_DATABASE_ID = FALLBACK_FIRESTORE_DATABASE_ID;
  }

  if (!process.env.FIRESTORE_DATABASE_ID?.trim()) {
    try {
      const cfg = JSON.parse(
        readFileSync(resolve(root, 'firebase-applet-config.json'), 'utf8')
      ) as { firestoreDatabaseId?: string };
      if (cfg.firestoreDatabaseId) {
        process.env.FIRESTORE_DATABASE_ID = cfg.firestoreDatabaseId;
      }
    } catch {
      // ignore
    }
  }
}

loadEnvFiles();

export function assertSeedEnv(): void {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ?? '';
  if (!key || key.length < 500 || PLACEHOLDER.test(key)) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY missing or invalid. Run: npx vercel env run --environment=production -- npm run seed:all:full'
    );
  }
}
