import type { VercelRequest, VercelResponse } from '@vercel/node';

// We must lazy-load firebase-admin to prevent Vercel from timing out during module initialization
let adminApp: any = null;

const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-d612fcdb-7a91-4b68-99fc-cca70ab71581';

async function initFirebaseAdmin() {
  if (adminApp) return adminApp;

  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  
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
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  } else {
    adminApp = apps[0];
  }

  return adminApp;
}

export async function getAdminDb() {
  const app = await initFirebaseAdmin();
  const { getFirestore } = await import('firebase-admin/firestore');
  
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    DEFAULT_FIRESTORE_DATABASE_ID;

  return databaseId.trim() ? getFirestore(app, databaseId.trim()) : getFirestore(app);
}

export async function getAdminAuth() {
  const app = await initFirebaseAdmin();
  const { getAuth } = await import('firebase-admin/auth');
  return getAuth(app);
}
