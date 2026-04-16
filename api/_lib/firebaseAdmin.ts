import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-d612fcdb-7a91-4b68-99fc-cca70ab71581';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  }

  return JSON.parse(raw);
}

function getFirestoreDatabaseId(): string | undefined {
  const configured =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    DEFAULT_FIRESTORE_DATABASE_ID;

  return configured?.trim() || undefined;
}

export function getAdminDb() {
  const app = getAdminApp();
  const databaseId = getFirestoreDatabaseId();
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

function getAdminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(getServiceAccount()),
    });
  }

  return getApp();
}
