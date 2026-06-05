# Superadmin Users Backend Init Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/api/admin/users` failures by making Firebase Admin initialization deterministic and defaulting safely to the standard Firestore database unless an explicit named database id is configured.

**Architecture:** Keep the existing admin-only endpoint and UI flow. Improve `api/_lib/firebaseAdmin.ts` so Firestore uses the default database by default, and only uses a named database when explicitly configured via env vars. Add focused unit tests for the database id resolution and cache behavior.

**Tech Stack:** Vite + React, Vercel serverless functions (`api/*`), Firebase Auth + Firestore, `firebase-admin`, Vitest

---

## File Map (Planned Changes)

**Modify**
- `api/_lib/firebaseAdmin.ts`
  - Remove hardcoded Firestore database fallback
  - Resolve database id from env vars explicitly
  - Treat empty / `(default)` as default database
  - Cache Firestore instances by resolved database key
- `vitest.config.ts`
  - Include `api/**/*.test.ts` so we can test serverless helpers
- `.env.example`
  - Document required backend env vars for Vercel/local

**Create**
- `api/_lib/firebaseAdmin.test.ts`
  - Unit tests for database id resolution and caching behavior

## Task 1: Add Tests for Firebase Admin DB Resolution

**Files:**
- Modify: `vitest.config.ts`
- Create: `api/_lib/firebaseAdmin.test.ts`

- [ ] **Step 1: Update Vitest to run `api/**/*.test.ts`**

Edit `vitest.config.ts` to include both `src` and `api` test globs.

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    clearMocks: true,
  },
});
```

- [ ] **Step 2: Create tests that validate DB id resolution and caching**

Create `api/_lib/firebaseAdmin.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * These tests stub firebase-admin modules so we can validate our DB id selection logic
 * without requiring real credentials.
 */
vi.mock('firebase-admin/app', () => {
  return {
    cert: (sa: any) => sa,
    getApps: () => [],
    initializeApp: vi.fn(() => ({ __app: true })),
  };
});

const getFirestoreMock = vi.fn((app: any, databaseId?: string) => {
  return { __db: true, app, databaseId: databaseId ?? null };
});

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: getFirestoreMock,
  };
});

vi.mock('firebase-admin/auth', () => {
  return {
    getAuth: vi.fn(() => ({ __auth: true })),
  };
});

describe('firebaseAdmin getAdminDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure we get a fresh module instance per test so the global cache doesn't leak.
    delete (globalThis as any).__hireschemaFirebaseAdmin;

    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      project_id: 'test-project',
      client_email: 'test@example.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
    });

    delete process.env.FIRESTORE_DATABASE_ID;
    delete process.env.FIREBASE_FIRESTORE_DATABASE_ID;
  });

  it('uses default Firestore database when no database id env var is set', async () => {
    const { getAdminDb } = await import('./firebaseAdmin');
    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: null });
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);
    expect(getFirestoreMock.mock.calls[0]?.length).toBe(1); // getFirestore(app)
  });

  it('uses named Firestore database when FIRESTORE_DATABASE_ID is set', async () => {
    process.env.FIRESTORE_DATABASE_ID = 'named-db';
    const { getAdminDb } = await import('./firebaseAdmin');
    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: 'named-db' });
    expect(getFirestoreMock).toHaveBeenCalledWith(expect.anything(), 'named-db');
  });

  it('treats "(default)" as the default database (do not pass database id)', async () => {
    process.env.FIRESTORE_DATABASE_ID = '(default)';
    const { getAdminDb } = await import('./firebaseAdmin');
    const db = await getAdminDb();

    expect(db).toMatchObject({ __db: true, databaseId: null });
    expect(getFirestoreMock.mock.calls[0]?.length).toBe(1);
  });

  it('caches Firestore instance per resolved database id', async () => {
    const { getAdminDb } = await import('./firebaseAdmin');

    const db1 = await getAdminDb();
    const db2 = await getAdminDb();
    expect(db1).toBe(db2);
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);

    process.env.FIRESTORE_DATABASE_ID = 'named-db';
    const db3 = await getAdminDb();
    expect(db3).not.toBe(db1);
    expect(getFirestoreMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run the tests**

Run:

```bash
npm test
```

Expected: PASS (new tests run for both `src` and `api`).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts api/_lib/firebaseAdmin.test.ts
git commit -m "test: cover firebase admin db selection and caching"
```

## Task 2: Fix Firebase Admin Firestore Database Selection

**Files:**
- Modify: `api/_lib/firebaseAdmin.ts`

- [ ] **Step 1: Replace hardcoded fallback database id with explicit env resolution**

Update `api/_lib/firebaseAdmin.ts` to:
- Remove `DEFAULT_FIRESTORE_DATABASE_ID`
- Add a small helper `resolveFirestoreDatabaseIdFromEnv()`
- Only pass `databaseId` to `getFirestore(app, databaseId)` when it is a real named database id

Target implementation:

```ts
// ...existing imports...

// Use a stable key for caching the default database client.
const DEFAULT_DB_CACHE_KEY = '__default__';

function resolveFirestoreDatabaseIdFromEnv(): string | undefined {
  const raw =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    '';

  const value = raw.trim();
  if (!value) return undefined;

  // Firestore often refers to the default database as "(default)".
  // In firebase-admin, we should use getFirestore(app) for default.
  if (value === '(default)') return undefined;

  return value;
}

export async function getAdminDb() {
  const app = await initFirebaseAdmin();
  const databaseId = resolveFirestoreDatabaseIdFromEnv();
  const cacheKey = databaseId ?? DEFAULT_DB_CACHE_KEY;

  if (cache.db && cache.dbId === cacheKey) {
    return cache.db;
  }

  cache.firestoreModPromise ||= import('firebase-admin/firestore');
  const { getFirestore } = await cache.firestoreModPromise;

  cache.db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  cache.dbId = cacheKey;
  return cache.db;
}
```

Also update the cache type so `dbId` is a cache key, not necessarily a real database id (because default is now a sentinel).

- [ ] **Step 2: Ensure config failures remain explicit**

Keep the existing behavior in `initFirebaseAdmin()`:
- throw a clear error if `FIREBASE_SERVICE_ACCOUNT_KEY` is missing
- throw a clear error if JSON parsing fails

Do not log secret content.

- [ ] **Step 3: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run type-check**

Run:

```bash
npm run lint
```

Expected: PASS (no TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/firebaseAdmin.ts
git commit -m "fix: default firebase-admin firestore to standard database"
```

## Task 3: Document Required Environment Variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add backend env var documentation**

Append to `.env.example`:

```bash
# ==========================================================
# Backend / Vercel Serverless (Required for Superadmin + crons)
# ==========================================================
#
# Stringified JSON for a Firebase service account with access to:
# - Firebase Auth (verifyIdToken)
# - Firestore (read users collection)
#
# Vercel: Project Settings -> Environment Variables
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'

# Optional: only set this if you are intentionally using a named Firestore database.
# Leave unset for the default Firestore database.
# FIRESTORE_DATABASE_ID="your-named-database-id"
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: clarify backend env vars for superadmin users endpoint"
```

## Task 4: Local/Deploy Verification Checklist

**Files:**
- No code changes required in this task.

- [ ] **Step 1: Local verification (optional)**

Run dev server:

```bash
npm install
npm run dev
```

Open the app, sign in as allowlisted superadmin email, open Superadmin page, and confirm it loads users.

- [ ] **Step 2: Deployed verification (Vercel)**

In Vercel:
- Confirm `FIREBASE_SERVICE_ACCOUNT_KEY` is set for the correct environment (Production / Preview).
- Confirm `FIRESTORE_DATABASE_ID` is unset unless you intentionally use a named Firestore database.

Then reload the Superadmin page and confirm the users list loads.

- [ ] **Step 3: Smoke-check crons**

Because `getAdminDb()` is used by cron endpoints too:
- visit `/api/cron/daily-alerts` in a controlled environment or check Vercel cron logs
- confirm it no longer fails during Firestore initialization

## Task 5: Final Diagnostics Pass

**Files:**
- No code changes required in this task.

- [ ] **Step 1: Check editor diagnostics**

Use IDE diagnostics for:
- `api/_lib/firebaseAdmin.ts`
- `api/_lib/firebaseAdmin.test.ts`
- `vitest.config.ts`

- [ ] **Step 2: Final test run**

Run:

```bash
npm test
```

Expected: PASS.

---

## Spec Coverage Self-Review

- Backend init determinism: Implemented by removing hardcoded DB fallback and using explicit env resolution.
- Clear failure modes: Existing explicit errors preserved; bootstrap now avoids silent wrong-db behavior.
- Testing: Added focused unit tests for database id resolution and cache behavior.
- Documentation: Updated `.env.example` with required serverless env vars.
