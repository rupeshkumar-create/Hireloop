import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getFirestoreMock, getAuthMock, initializeAppMock } = vi.hoisted(() => ({
  getFirestoreMock: vi.fn((app: unknown, databaseId?: string) => ({
    __db: true,
    app,
    databaseId: databaseId ?? null,
  })),
  getAuthMock: vi.fn(() => ({ __auth: true })),
  initializeAppMock: vi.fn(() => ({ __app: true })),
}));

vi.mock('firebase-admin/app', () => ({
  cert: (serviceAccount: unknown) => serviceAccount,
  getApps: () => [],
  initializeApp: initializeAppMock,
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: getFirestoreMock,
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: getAuthMock,
}));

describe('getAdminDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    delete (globalThis as { __hireschemaFirebaseAdmin?: unknown }).__hireschemaFirebaseAdmin;

    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      project_id: 'test-project',
      client_email: 'test@example.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
    });

    delete process.env.FIRESTORE_DATABASE_ID;
    delete process.env.FIREBASE_FIRESTORE_DATABASE_ID;
  });

  it('uses the default Firestore database when no database id env var is set', async () => {
    const { getAdminDb } = await import('./firebaseAdmin');

    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: null });
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);
    expect(getFirestoreMock.mock.calls[0]).toHaveLength(1);
  });

  it('uses a named Firestore database when FIRESTORE_DATABASE_ID is set', async () => {
    process.env.FIRESTORE_DATABASE_ID = 'named-db';
    const { getAdminDb } = await import('./firebaseAdmin');

    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: 'named-db' });
    expect(getFirestoreMock).toHaveBeenCalledWith(expect.anything(), 'named-db');
  });

  it('treats "(default)" as the default Firestore database', async () => {
    process.env.FIRESTORE_DATABASE_ID = '(default)';
    const { getAdminDb } = await import('./firebaseAdmin');

    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: null });
    expect(getFirestoreMock.mock.calls[0]).toHaveLength(1);
  });

  it('falls back to FIREBASE_FIRESTORE_DATABASE_ID when FIRESTORE_DATABASE_ID is unset', async () => {
    process.env.FIREBASE_FIRESTORE_DATABASE_ID = 'secondary-db';
    const { getAdminDb } = await import('./firebaseAdmin');

    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: 'secondary-db' });
    expect(getFirestoreMock).toHaveBeenCalledWith(expect.anything(), 'secondary-db');
  });

  it('caches the Firestore client per resolved database id', async () => {
    const { getAdminDb } = await import('./firebaseAdmin');

    const firstDb = await getAdminDb();
    const secondDb = await getAdminDb();

    expect(secondDb).toBe(firstDb);
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);

    process.env.FIRESTORE_DATABASE_ID = 'named-db';
    const thirdDb = await getAdminDb();

    expect(thirdDb).not.toBe(firstDb);
    expect(getFirestoreMock).toHaveBeenCalledTimes(2);
  });
});
