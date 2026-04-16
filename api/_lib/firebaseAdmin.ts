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

const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-d612fcdb-7a91-4b68-99fc-cca70ab71581';

async function initFirebaseAdmin() {
  if (cache.app) return cache.app;

  cache.appModPromise ||= import('firebase-admin/app');
  const { cert, getApps, initializeApp } = await cache.appModPromise;
  
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim()) {
    throw new Error('Server Configuration Error: Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }

  let serviceAccount;
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
  const databaseId = (
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    DEFAULT_FIRESTORE_DATABASE_ID
  ).trim();

  if (cache.db && cache.dbId === databaseId) {
    return cache.db;
  }

  cache.firestoreModPromise ||= import('firebase-admin/firestore');
  const { getFirestore } = await cache.firestoreModPromise;
  
  cache.db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  cache.dbId = databaseId;
  return cache.db;
}

export async function getAdminAuth() {
  const app = await initFirebaseAdmin();
  if (cache.auth) {
    return cache.auth;
  }

  cache.authModPromise ||= import('firebase-admin/auth');
  const { getAuth } = await cache.authModPromise;
  cache.auth = getAuth(app);
  return cache.auth;
}
