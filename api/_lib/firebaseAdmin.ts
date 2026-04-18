// We must lazy-load firebase-admin to prevent Vercel from timing out during module initialization
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

type GlobalAdminCache = {
  app: App | null;
  auth: Auth | null;
  db: Firestore | null;
  dbId: string | null;
  appModPromise: Promise<any> | null;
  authModPromise: Promise<any> | null;
  firestoreModPromise: Promise<any> | null;
};

const globalCache = (globalThis as any).__hireschemaFirebaseAdmin as GlobalAdminCache | undefined;
const cache: GlobalAdminCache =
  globalCache ||
  {
    app: null,
    auth: null,
    db: null,
    dbId: null,
    appModPromise: null,
    authModPromise: null,
    firestoreModPromise: null,
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

async function initFirebaseAdmin() {
  if (cache.app) return cache.app;

  if (!cache.appModPromise) {
    cache.appModPromise = import('firebase-admin/app');
  }

  let appModule: any;
  try {
    appModule = await cache.appModPromise;
  } catch (err) {
    // Clear the poisoned promise so subsequent cold-start retries can try again
    cache.appModPromise = null;
    throw err;
  }

  const { cert, getApps, initializeApp } = appModule;
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
    cache.app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    cache.app = apps[0];
  }

  return cache.app;
}

export async function getAdminDb() {
  const app = await initFirebaseAdmin();
  const databaseId = resolveFirestoreDatabaseIdFromEnv();
  const cacheKey = databaseId ?? DEFAULT_DB_CACHE_KEY;

  if (cache.db && cache.dbId === cacheKey) {
    return cache.db;
  }

  if (!cache.firestoreModPromise) {
    cache.firestoreModPromise = import('firebase-admin/firestore');
  }

  let firestoreModule: any;
  try {
    firestoreModule = await cache.firestoreModPromise;
  } catch (err) {
    cache.firestoreModPromise = null;
    throw err;
  }

  const { getFirestore } = firestoreModule;
  cache.db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  cache.dbId = cacheKey;
  return cache.db;
}

export async function getAdminAuth() {
  const app = await initFirebaseAdmin();
  if (cache.auth) {
    return cache.auth;
  }

  if (!cache.authModPromise) {
    cache.authModPromise = import('firebase-admin/auth');
  }

  let authModule: any;
  try {
    authModule = await cache.authModPromise;
  } catch (err) {
    cache.authModPromise = null;
    throw err;
  }

  const { getAuth } = authModule;
  cache.auth = getAuth(app);
  return cache.auth;
}
