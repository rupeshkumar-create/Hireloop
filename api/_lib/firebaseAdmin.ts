import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-d612fcdb-7a91-4b68-99fc-cca70ab71581';

/**
 * Safely parses the service account from environment variables.
 * Throws a descriptive error if missing or invalid, which should be caught by the route handler.
 */
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim()) {
    throw new Error('Server Configuration Error: Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }

  try {
    return JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Server Configuration Error: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON. ${error.message}`);
  }
}

/**
 * Determines the target Firestore Database ID from environment or fallback.
 */
function getFirestoreDatabaseId(): string | undefined {
  const configured =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    DEFAULT_FIRESTORE_DATABASE_ID;

  return configured?.trim() || undefined;
}

/**
 * Initializes the Firebase Admin App safely.
 * Will not re-initialize if already initialized in this serverless execution context.
 */
export function getAdminApp() {
  if (!getApps().length) {
    try {
      const credential = cert(getServiceAccount());
      initializeApp({ credential });
    } catch (error: any) {
      console.error('[Firebase Admin Init Error]', error);
      throw error;
    }
  }

  return getApp();
}

/**
 * Returns a Firestore instance targeting the configured database.
 */
export function getAdminDb() {
  const app = getAdminApp();
  const databaseId = getFirestoreDatabaseId();
  
  try {
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  } catch (error: any) {
    console.error('[Firestore Init Error]', error);
    throw new Error(`Failed to initialize Firestore: ${error.message}`);
  }
}

/**
 * Returns a Firebase Admin Auth instance.
 */
export function getAdminAuth() {
  const app = getAdminApp();
  try {
    return getAuth(app);
  } catch (error: any) {
    console.error('[Auth Init Error]', error);
    throw new Error(`Failed to initialize Firebase Auth: ${error.message}`);
  }
}
