// Static imports so Vercel's bundler correctly traces and bundles these packages.
// Previously used dynamic imports, which Vercel's bundler cannot trace — resulting
// in ERR_MODULE_NOT_FOUND at runtime even though firebase-admin is in package.json.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

type GlobalAdminCache = {
  app: App | null;
  auth: Auth | null;
  db: Firestore | null;
  dbId: string | null;
};

const globalCache = (globalThis as any).__hireschemaFirebaseAdmin as GlobalAdminCache | undefined;
const cache: GlobalAdminCache =
  globalCache ||
  {
    app: null,
    auth: null,
    db: null,
    dbId: null,
  };

(globalThis as any).__hireschemaFirebaseAdmin = cache;

const DEFAULT_DB_CACHE_KEY = '__default__';

function resolveFirestoreDatabaseIdFromEnv(): string | undefined {
  const raw =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    '';

  const value = raw.trim();
  if (!value || value === '(default)') {
    return undefined;
  }

  return value;
}

function initFirebaseAdmin() {
  if (cache.app) return cache.app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim()) {
    throw new Error('Server Configuration Error: Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Server Configuration Error: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON. ${error.message}`);
  }

  const apps = getApps();
  if (!apps.length) {
    cache.app = initializeApp({ credential: cert(serviceAccount as any) });
  } else {
    cache.app = apps[0];
  }

  return cache.app;
}

export function getAdminDb() {
  const app = initFirebaseAdmin();
  const databaseId = resolveFirestoreDatabaseIdFromEnv();
  const cacheKey = databaseId ?? DEFAULT_DB_CACHE_KEY;

  if (cache.db && cache.dbId === cacheKey) {
    return cache.db;
  }

  cache.db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  cache.dbId = cacheKey;
  return cache.db;
}

export function getAdminAuth() {
  const app = initFirebaseAdmin();
  if (cache.auth) {
    return cache.auth;
  }

  cache.auth = getAuth(app);
  return cache.auth;
}
