# Phase 8 Cron Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-owned daily cron engine that dispatches one protected per-user job run, stores daily matches before email delivery, and records each user/day execution outcome.

**Architecture:** Keep the existing Vercel cron entrypoint, but turn it into a lightweight dispatcher. Move the heavy per-user work into a pure `cronEngine` service that the new worker route calls with injected Firestore, job-generation, and email dependencies, so the orchestration is testable without spinning up real external systems.

**Tech Stack:** TypeScript, Vercel serverless functions, Firebase Admin Firestore, Vitest

---

## File Structure

- Create: `api/_lib/firebaseAdmin.ts`
- Create: `api/_lib/cronAuth.ts`
- Create: `src/services/cronEngine.ts`
- Create: `src/services/__tests__/cronEngine.test.ts`
- Create: `api/cron/process-user.ts`
- Create: `api/__tests__/cronRoutes.test.ts`
- Modify: `api/cron/daily-alerts.ts`
- Modify: `src/services/emailService.ts`

Each file has one clear role:

- `api/_lib/firebaseAdmin.ts`: one reusable Firebase Admin bootstrap and Firestore accessor for cron routes
- `api/_lib/cronAuth.ts`: shared bearer-token checks for Vercel cron and internal worker calls
- `cronEngine.ts`: pure cron helpers plus the per-user worker orchestration with injected dependencies
- `cronEngine.test.ts`: unit coverage for active-user filtering, IST run keys, state transitions, and send-after-store sequencing
- `process-user.ts`: thin protected route that loads Firestore and calls the worker service for one user
- `cronRoutes.test.ts`: route-level auth coverage for both cron endpoints
- `daily-alerts.ts`: dispatcher implementation that queues users once per IST day and fan-outs worker requests
- `emailService.ts`: small reusable payload builder so the worker can send the same daily email content without browser-only assumptions

### Task 1: Add Shared Cron Helpers And Their Tests

**Files:**
- Create: `src/services/cronEngine.ts`
- Create: `src/services/__tests__/cronEngine.test.ts`
- Test: `src/services/__tests__/cronEngine.test.ts`

- [ ] **Step 1: Write the failing cron-helper tests**

Create `src/services/__tests__/cronEngine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCronRunId,
  getCronRunDateIST,
  isActiveCronUser,
} from '../cronEngine';

describe('isActiveCronUser', () => {
  it('returns true when plan is present and alerts are enabled', () => {
    expect(
      isActiveCronUser({
        plan: 'pro',
        receiveDailyAlerts: true,
      })
    ).toBe(true);
  });

  it('returns false when the plan is missing', () => {
    expect(
      isActiveCronUser({
        receiveDailyAlerts: true,
      })
    ).toBe(false);
  });

  it('returns false when alerts are explicitly disabled', () => {
    expect(
      isActiveCronUser({
        plan: 'free',
        receiveDailyAlerts: false,
      })
    ).toBe(false);
  });
});

describe('getCronRunDateIST', () => {
  it('uses the IST calendar day instead of raw UTC midnight', () => {
    expect(getCronRunDateIST(new Date('2026-04-16T02:30:00.000Z'))).toBe('2026-04-16');
    expect(getCronRunDateIST(new Date('2026-04-15T21:00:00.000Z'))).toBe('2026-04-16');
  });
});

describe('buildCronRunId', () => {
  it('builds a deterministic user-day identifier', () => {
    expect(buildCronRunId('user_123', '2026-04-16')).toBe('user_123_2026-04-16');
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts
```

Expected: FAIL because `src/services/cronEngine.ts` does not exist yet.

- [ ] **Step 3: Implement the pure cron helpers**

Create `src/services/cronEngine.ts` with the initial helper exports:

```ts
export interface CronEligibleUser {
  plan?: string;
  receiveDailyAlerts?: boolean;
}

export function isActiveCronUser(user: CronEligibleUser): boolean {
  return Boolean(user.plan) && user.receiveDailyAlerts !== false;
}

export function getCronRunDateIST(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(now);
}

export function buildCronRunId(userId: string, runDate: string): string {
  return `${userId}_${runDate}`;
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts
```

Expected: PASS with all helper assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/services/cronEngine.ts src/services/__tests__/cronEngine.test.ts
git commit -m "feat: add cron engine helper primitives"
```

### Task 2: Add Reusable Firebase Admin And Cron Auth Utilities

**Files:**
- Create: `api/_lib/firebaseAdmin.ts`
- Create: `api/_lib/cronAuth.ts`
- Create: `api/__tests__/cronRoutes.test.ts`
- Test: `api/__tests__/cronRoutes.test.ts`

- [ ] **Step 1: Write the failing auth tests for both cron routes**

Create `api/__tests__/cronRoutes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cron/daily-alerts', async () => {
  const actual = await vi.importActual<typeof import('../cron/daily-alerts')>('../cron/daily-alerts');
  return actual;
});

vi.mock('../cron/process-user', async () => {
  const actual = await vi.importActual<typeof import('../cron/process-user')>('../cron/process-user');
  return actual;
});

import dailyAlertsHandler from '../cron/daily-alerts';
import processUserHandler from '../cron/process-user';

function createRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    end(payload?: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('cron route auth', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.INTERNAL_CRON_SECRET = 'worker-secret';
  });

  it('rejects daily alerts requests without the cron secret', async () => {
    const req: any = { method: 'GET', headers: {} };
    const res = createRes();

    await dailyAlertsHandler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects worker requests without the internal cron secret', async () => {
    const req: any = { method: 'POST', headers: {}, body: { userId: 'user_123' } };
    const res = createRes();

    await processUserHandler(req, res);

    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run:

```bash
npm test -- api/__tests__/cronRoutes.test.ts
```

Expected: FAIL because `api/cron/process-user.ts` and the shared auth helpers do not exist yet.

- [ ] **Step 3: Add the Firebase Admin helper**

Create `api/_lib/firebaseAdmin.ts`:

```ts
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  }

  return JSON.parse(raw);
}

export function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(getServiceAccount()),
    });
  }

  return getFirestore();
}
```

- [ ] **Step 4: Add the shared cron auth helper**

Create `api/_lib/cronAuth.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

function hasBearerToken(req: VercelRequest, secret: string | undefined): boolean {
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

export function requireCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  if (hasBearerToken(req, process.env.CRON_SECRET)) {
    return true;
  }

  res.status(401).end('Unauthorized');
  return false;
}

export function requireInternalCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  if (hasBearerToken(req, process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET)) {
    return true;
  }

  res.status(401).end('Unauthorized');
  return false;
}
```

- [ ] **Step 5: Add the minimal worker route shell**

Create `api/cron/process-user.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireInternalCronSecret } from '../_lib/cronAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireInternalCronSecret(req, res)) {
    return;
  }

  return res.status(202).json({ ok: true });
}
```

- [ ] **Step 6: Run the route tests**

Run:

```bash
npm test -- api/__tests__/cronRoutes.test.ts
```

Expected: PASS with unauthorized requests rejected for both routes.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/firebaseAdmin.ts api/_lib/cronAuth.ts api/cron/process-user.ts api/__tests__/cronRoutes.test.ts
git commit -m "feat: add cron auth and firebase admin helpers"
```

### Task 3: Add The Per-User Worker Orchestration Service

**Files:**
- Modify: `src/services/cronEngine.ts`
- Modify: `src/services/__tests__/cronEngine.test.ts`
- Modify: `src/services/emailService.ts`
- Test: `src/services/__tests__/cronEngine.test.ts`

- [ ] **Step 1: Extend the worker tests with state transitions and send-after-store sequencing**

Append these tests to `src/services/__tests__/cronEngine.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  processUserCronRun,
  type CronRunRecord,
} from '../cronEngine';

describe('processUserCronRun', () => {
  it('marks incomplete users as skipped', async () => {
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
          email: 'person@example.com',
          careerPaths: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
      sendDailyEmail: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.generateJobs).not.toHaveBeenCalled();
    expect(deps.sendDailyEmail).not.toHaveBeenCalled();
  });

  it('stores jobs before sending email', async () => {
    const order: string[] = [];

    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          plan: 'pro',
          receiveDailyAlerts: true,
          email: 'person@example.com',
          careerPaths: ['Frontend Engineer'],
          jobType: 'both',
          minSalary: null,
          resumeText: '',
          location: '',
          learningProfile: {},
          learningSignals: undefined,
          seenJobFingerprints: [],
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'queued',
      } as CronRunRecord),
      markRun: vi.fn().mockResolvedValue(undefined),
      generateJobs: vi.fn().mockResolvedValue({
        jobs: [
          {
            title: 'Frontend Engineer',
            company: 'Acme',
            location: 'Remote',
            salary: 'Competitive',
            description: 'Build UI',
            url: 'https://jobs.example.com/1',
            requirements: [],
            matchScore: 92,
            datePosted: '2026-04-16T00:00:00.000Z',
          },
        ],
        requestedLimit: 10,
        usedBackfill: false,
        totalValidatedJobs: 1,
        unseenCount: 1,
        seenCount: 0,
      }),
      storeJobs: vi.fn().mockImplementation(async () => {
        order.push('store');
      }),
      sendDailyEmail: vi.fn().mockImplementation(async () => {
        order.push('email');
      }),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('completed');
    expect(order).toEqual(['store', 'email']);
  });

  it('does not re-process a completed run', async () => {
    const deps = {
      loadUser: vi.fn(),
      getExistingRun: vi.fn().mockResolvedValue({
        id: 'user_123_2026-04-16',
        status: 'completed',
      } as CronRunRecord),
      markRun: vi.fn(),
      generateJobs: vi.fn(),
      storeJobs: vi.fn(),
      sendDailyEmail: vi.fn(),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-16' },
      deps
    );

    expect(result.status).toBe('skipped');
    expect(deps.loadUser).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the worker tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts
```

Expected: FAIL because the worker orchestration API does not exist yet.

- [ ] **Step 3: Add a reusable daily-email payload helper**

Update `src/services/emailService.ts` so the daily email HTML can be reused by browser and cron code:

```ts
export function buildDailyJobAlertsEmailPayload(userEmail: string, jobs: any[]) {
  return {
    from: 'Hireschema Alerts <alerts@hireschema.com>',
    to: [userEmail],
    subject: `Your Daily Job Matches - ${jobs.length} New Roles`,
    html: `
      <div>
        <h2>We found ${jobs.length} new jobs for you today!</h2>
        <ul>
          ${jobs.map(job => `
            <li style="margin-bottom: 12px;">
              <strong>${job.title}</strong> at ${job.company}<br/>
              <a href="${job.url}">Apply Here</a>
            </li>
          `).join('')}
        </ul>
      </div>
    `,
  };
}

export const sendDailyJobAlertsEmail = async (userEmail: string, jobs: any[]) => {
  if (!jobs || jobs.length === 0) return null;

  return await sendResendEmail(buildDailyJobAlertsEmailPayload(userEmail, jobs));
};
```

- [ ] **Step 4: Implement the worker orchestration in `cronEngine.ts`**

Append these types and the worker function to `src/services/cronEngine.ts`:

```ts
import { getDailyMatchLimit } from '../lib/planLimits';

export interface CronRunRecord {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  failureReason?: string;
}

export interface ProcessUserCronRunInput {
  userId: string;
  runDate: string;
}

export interface ProcessUserCronRunDeps {
  loadUser: (userId: string) => Promise<{ id: string; data: any } | null>;
  getExistingRun: (runId: string) => Promise<CronRunRecord | null>;
  markRun: (runId: string, patch: Record<string, unknown>) => Promise<void>;
  generateJobs: (profile: any, limit: number) => Promise<any>;
  storeJobs: (userId: string, runDate: string, profile: any, result: any) => Promise<void>;
  sendDailyEmail: (email: string, jobs: any[]) => Promise<void>;
}

export async function processUserCronRun(
  input: ProcessUserCronRunInput,
  deps: ProcessUserCronRunDeps
) {
  const runId = buildCronRunId(input.userId, input.runDate);
  const existingRun = await deps.getExistingRun(runId);

  if (existingRun?.status === 'completed' || existingRun?.status === 'processing') {
    return { runId, status: 'skipped' as const };
  }

  const loadedUser = await deps.loadUser(input.userId);
  if (!loadedUser || !isActiveCronUser(loadedUser.data)) {
    await deps.markRun(runId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
      failureReason: 'Inactive or missing user',
    });
    return { runId, status: 'skipped' as const };
  }

  const profile = loadedUser.data;
  if (!profile.email || !Array.isArray(profile.careerPaths) || profile.careerPaths.length === 0) {
    await deps.markRun(runId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
      failureReason: 'Profile missing email or career paths',
    });
    return { runId, status: 'skipped' as const };
  }

  await deps.markRun(runId, {
    status: 'processing',
    startedAt: new Date().toISOString(),
  });

  try {
    const limit = getDailyMatchLimit(profile.plan);
    const result = await deps.generateJobs(profile, limit);
    await deps.storeJobs(input.userId, input.runDate, profile, result);

    if (result.jobs.length > 0) {
      await deps.sendDailyEmail(profile.email, result.jobs);
    }

    await deps.markRun(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      jobsStored: result.jobs.length,
      emailSent: result.jobs.length > 0,
    });

    return { runId, status: 'completed' as const };
  } catch (error) {
    await deps.markRun(runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      failureReason: error instanceof Error ? error.message : String(error),
    });
    return { runId, status: 'failed' as const };
  }
}
```

- [ ] **Step 5: Run the worker tests**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts
```

Expected: PASS with helper and orchestration tests green.

- [ ] **Step 6: Commit**

```bash
git add src/services/cronEngine.ts src/services/__tests__/cronEngine.test.ts src/services/emailService.ts
git commit -m "feat: add per-user cron worker orchestration"
```

### Task 4: Wire The Protected Worker Route To Real Firestore And Existing Generation Logic

**Files:**
- Modify: `api/cron/process-user.ts`
- Modify: `src/services/cronEngine.ts`
- Test: `api/__tests__/cronRoutes.test.ts`

- [ ] **Step 1: Add a generation adapter inside `cronEngine.ts`**

Append this helper to `src/services/cronEngine.ts`:

```ts
import { generateDailyJobs } from './aiService';

export async function generateJobsForCronProfile(profile: any, limit: number) {
  return generateDailyJobs(
    profile.careerPaths || [],
    profile.jobType || 'both',
    profile.minSalary || null,
    profile.resumeText || '',
    limit,
    profile.seenJobFingerprints || [],
    profile.learningProfile?.jobPreferences || '',
    profile.location || '',
    profile.learningSignals
  );
}
```

- [ ] **Step 2: Replace the placeholder worker route with real dependencies**

Update `api/cron/process-user.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { requireInternalCronSecret } from '../_lib/cronAuth';
import {
  buildCronRunId,
  generateJobsForCronProfile,
  processUserCronRun,
} from '../../src/services/cronEngine';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireInternalCronSecret(req, res)) {
    return;
  }

  const { userId, runDate } = req.body || {};
  if (!userId || !runDate) {
    return res.status(400).json({ error: 'Missing userId or runDate' });
  }

  const db = getAdminDb();

  const result = await processUserCronRun(
    { userId, runDate },
    {
      loadUser: async (targetUserId) => {
        const snap = await db.collection('users').doc(targetUserId).get();
        return snap.exists ? { id: snap.id, data: snap.data() } : null;
      },
      getExistingRun: async (runId) => {
        const snap = await db.collection('cronRuns').doc(runId).get();
        return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
      },
      markRun: async (runId, patch) => {
        await db.collection('cronRuns').doc(runId).set(
          {
            userId,
            runDate,
            dispatchSource: 'daily-alerts',
            ...patch,
          },
          { merge: true }
        );
      },
      generateJobs: async (profile, limit) => generateJobsForCronProfile(profile, limit),
      storeJobs: async (targetUserId, targetRunDate, profile, generated) => {
        const fetchedAt = new Date().toISOString();
        const jobs = generated.jobs;
        const seenFingerprints = [
          ...(profile.seenJobFingerprints || []),
          ...jobs.map((job: any) => `${job.title}`),
        ].slice(-300);

        await db.collection('users').doc(targetUserId).set(
          {
            dailyJobs: jobs,
            lastJobFetchTime: fetchedAt,
            seenJobFingerprints,
          },
          { merge: true }
        );

        await db.collection('users').doc(targetUserId).collection('daily_matches').doc(targetRunDate).set(
          {
            jobs,
            fetchedAt,
          },
          { merge: true }
        );
      },
      sendDailyEmail: async (email, jobs) => {
        const payload = buildDailyJobAlertsEmailPayload(email, jobs);
        const response = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/resend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to send daily alert email');
        }
      },
    }
  );

  return res.status(200).json(result);
}
```

- [ ] **Step 3: Run the route tests again**

Run:

```bash
npm test -- api/__tests__/cronRoutes.test.ts
```

Expected: PASS with the route still rejecting unauthorized requests after the real worker wiring lands.

- [ ] **Step 4: Run the targeted worker tests again**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts
```

Expected: PASS, confirming the route wiring did not break the pure worker orchestration contract.

- [ ] **Step 5: Commit**

```bash
git add api/cron/process-user.ts src/services/cronEngine.ts
git commit -m "feat: connect cron worker route to job generation"
```

### Task 5: Convert The Daily Cron Route Into A Real Dispatcher

**Files:**
- Modify: `api/cron/daily-alerts.ts`
- Modify: `src/services/cronEngine.ts`
- Test: `src/services/__tests__/cronEngine.test.ts`
- Test: `api/__tests__/cronRoutes.test.ts`

- [ ] **Step 1: Add dispatcher helper tests for duplicate suppression**

Append this test to `src/services/__tests__/cronEngine.test.ts`:

```ts
import { queueCronRun } from '../cronEngine';

describe('queueCronRun', () => {
  it('creates a queued run only once per user and run date', async () => {
    const createRun = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const first = await queueCronRun(
      { userId: 'user_123', runDate: '2026-04-16', plan: 'pro', email: 'person@example.com' },
      { createRun }
    );
    const second = await queueCronRun(
      { userId: 'user_123', runDate: '2026-04-16', plan: 'pro', email: 'person@example.com' },
      { createRun }
    );

    expect(first.status).toBe('queued');
    expect(second.status).toBe('duplicate');
  });
});
```

- [ ] **Step 2: Run the cron-engine tests to verify the new dispatcher test fails**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts
```

Expected: FAIL because `queueCronRun()` does not exist yet.

- [ ] **Step 3: Implement the dispatcher helper**

Append this helper to `src/services/cronEngine.ts`:

```ts
export interface QueueCronRunInput {
  userId: string;
  runDate: string;
  plan: string;
  email?: string;
}

export async function queueCronRun(
  input: QueueCronRunInput,
  deps: {
    createRun: (run: QueueCronRunInput & { runId: string }) => Promise<boolean>;
  }
) {
  const runId = buildCronRunId(input.userId, input.runDate);
  const created = await deps.createRun({ ...input, runId });

  return {
    runId,
    status: created ? ('queued' as const) : ('duplicate' as const),
  };
}
```

- [ ] **Step 4: Replace the stub dispatcher route**

Update `api/cron/daily-alerts.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { requireCronSecret } from '../_lib/cronAuth';
import {
  getCronRunDateIST,
  isActiveCronUser,
  queueCronRun,
} from '../../src/services/cronEngine';

const DISPATCH_BATCH_SIZE = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) {
    return;
  }

  try {
    const db = getAdminDb();
    const runDate = getCronRunDateIST();
    const snapshot = await db.collection('users').limit(DISPATCH_BATCH_SIZE).get();

    let queued = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const userDoc of snapshot.docs) {
      const profile = userDoc.data();
      if (!isActiveCronUser(profile)) {
        skipped += 1;
        continue;
      }

      const queueResult = await queueCronRun(
        {
          userId: userDoc.id,
          runDate,
          plan: profile.plan,
          email: profile.email,
        },
        {
          createRun: async ({ runId, ...record }) => {
            const ref = db.collection('cronRuns').doc(runId);
            const existing = await ref.get();
            if (existing.exists) return false;

            await ref.set({
              ...record,
              status: 'queued',
              dispatchSource: 'daily-alerts',
              createdAt: FieldValue.serverTimestamp(),
            });
            return true;
          },
        }
      );

      if (queueResult.status === 'duplicate') {
        duplicates += 1;
        continue;
      }

      queued += 1;

      await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/cron/process-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          userId: userDoc.id,
          runDate,
        }),
      });
    }

    return res.status(200).json({ queued, skipped, duplicates, runDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
```

- [ ] **Step 5: Run the focused test suite**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts api/__tests__/cronRoutes.test.ts
```

Expected: PASS with helper, worker, and auth coverage still green.

- [ ] **Step 6: Run the type check**

Run:

```bash
npm run lint
```

Expected: PASS with no new type errors in the dispatcher or worker routes.

- [ ] **Step 7: Commit**

```bash
git add api/cron/daily-alerts.ts src/services/cronEngine.ts
git commit -m "feat: add daily cron dispatcher"
```

### Task 6: Tighten Persistence And Final Regressions

**Files:**
- Modify: `api/cron/process-user.ts`
- Modify: `src/services/__tests__/cronEngine.test.ts`
- Test: `src/services/__tests__/cronEngine.test.ts`
- Test: `api/__tests__/cronRoutes.test.ts`

- [ ] **Step 1: Replace the temporary seen-fingerprint write with the real fingerprint helper**

Update the `storeJobs` dependency in `api/cron/process-user.ts`:

```ts
import { jobFingerprint } from '../../src/services/serperService';

const nextFingerprints = [
  ...(profile.seenJobFingerprints || []),
  ...jobs.map((job: any) => jobFingerprint(job.title, job.company)),
].slice(-300);

await db.collection('users').doc(targetUserId).set(
  {
    dailyJobs: jobs,
    lastJobFetchTime: fetchedAt,
    seenJobFingerprints: nextFingerprints,
  },
  { merge: true }
);
```

- [ ] **Step 2: Add a failure-path test for email-after-storage**

Append this test to `src/services/__tests__/cronEngine.test.ts`:

```ts
it('marks the run failed when email delivery fails after storage', async () => {
  const deps = {
    loadUser: vi.fn().mockResolvedValue({
      id: 'user_123',
      data: {
        plan: 'free',
        receiveDailyAlerts: true,
        email: 'person@example.com',
        careerPaths: ['Frontend Engineer'],
        seenJobFingerprints: [],
      },
    }),
    getExistingRun: vi.fn().mockResolvedValue({
      id: 'user_123_2026-04-16',
      status: 'queued',
    } as CronRunRecord),
    markRun: vi.fn().mockResolvedValue(undefined),
    generateJobs: vi.fn().mockResolvedValue({
      jobs: [
        {
          title: 'Frontend Engineer',
          company: 'Acme',
          location: 'Remote',
          salary: 'Competitive',
          description: 'Build UI',
          url: 'https://jobs.example.com/1',
          requirements: [],
          matchScore: 92,
          datePosted: '2026-04-16T00:00:00.000Z',
        },
      ],
    }),
    storeJobs: vi.fn().mockResolvedValue(undefined),
    sendDailyEmail: vi.fn().mockRejectedValue(new Error('smtp failed')),
  };

  const result = await processUserCronRun(
    { userId: 'user_123', runDate: '2026-04-16' },
    deps
  );

  expect(result.status).toBe('failed');
  expect(deps.storeJobs).toHaveBeenCalledTimes(1);
  expect(deps.sendDailyEmail).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run the targeted tests**

Run:

```bash
npm test -- src/services/__tests__/cronEngine.test.ts api/__tests__/cronRoutes.test.ts
```

Expected: PASS with the new failure-path regression covered.

- [ ] **Step 4: Run the full project test suite**

Run:

```bash
npm test
```

Expected: PASS with existing service and component tests still green.

- [ ] **Step 5: Run the final type check**

Run:

```bash
npm run lint
```

Expected: PASS with no new TypeScript diagnostics.

- [ ] **Step 6: Commit**

```bash
git add api/cron/process-user.ts src/services/__tests__/cronEngine.test.ts
git commit -m "test: cover cron persistence and email sequencing"
```

## Self-Review

Spec coverage check:

- dispatcher route: covered in Task 5
- worker route: covered in Tasks 2 and 4
- active-user rule: covered in Task 1 tests and Task 5 dispatcher logic
- IST run date and deterministic run key: covered in Task 1
- execution records and idempotency: covered in Tasks 3 and 5
- store before email: covered in Task 3 and Task 6
- plan-aware limits: covered in Task 3 via `getDailyMatchLimit()` and Task 4 generation adapter
- auth rejection: covered in Task 2 tests

Placeholder scan:

- no `TODO`, `TBD`, or “handle appropriately” placeholders remain
- each code-changing step includes concrete code
- each verification step includes exact commands and expected outcomes

Type consistency check:

- shared names stay consistent across tasks: `getCronRunDateIST()`, `buildCronRunId()`, `processUserCronRun()`, `queueCronRun()`
- run statuses stay consistent across plan steps: `queued`, `processing`, `completed`, `failed`, `skipped`

