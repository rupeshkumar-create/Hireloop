# Admin Ghost Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a super-admin-only `Simulate for User` flow that runs the real daily jobs pipeline, shows accepted and rejected jobs with rejection codes, and optionally persists the simulated result without sending email.

**Architecture:** Keep the real daily generation logic in `src/services/aiService.ts`, but extract the new debug-result shaping into a focused helper module so Ghost Mode and normal generation stay aligned. Put preview-vs-persist logic in a small `adminGhostMode` service with injected persistence and logging dependencies, then keep the UI thin by rendering a dedicated modal component from `AdminDashboard`.

**Tech Stack:** TypeScript, React, Firebase Firestore client SDK, Vitest

---

## File Structure

- Create: `src/types/adminGhostMode.ts`
- Create: `src/services/dailyJobsEngine.ts`
- Create: `src/services/adminGhostMode.ts`
- Create: `src/services/__tests__/dailyJobsEngine.test.ts`
- Create: `src/services/__tests__/aiServiceGhostMode.test.ts`
- Create: `src/services/__tests__/adminGhostMode.test.ts`
- Create: `src/components/admin/GhostModeModal.tsx`
- Modify: `src/services/aiService.ts`
- Modify: `src/pages/AdminDashboard.tsx`

Each file has one clear role:

- `src/types/adminGhostMode.ts`: shared types for debug payloads, run modes, overrides, and admin orchestration
- `src/services/dailyJobsEngine.ts`: pure helpers for seen-job splitting and rejected-job code summaries
- `src/services/adminGhostMode.ts`: preview-vs-persist orchestration with injected generation, persistence, and audit-log dependencies
- `src/services/__tests__/dailyJobsEngine.test.ts`: unit coverage for code aggregation and seen-job partitioning
- `src/services/__tests__/aiServiceGhostMode.test.ts`: compatibility coverage for mapping the debug payload back into the existing `generateDailyJobs()` result shape
- `src/services/__tests__/adminGhostMode.test.ts`: unit coverage for overrides, required-profile validation, preview safety, and persist behavior
- `src/components/admin/GhostModeModal.tsx`: focused Ghost Mode form and result rendering surface
- `src/services/aiService.ts`: real pipeline integration and new `generateDailyJobsDebug()` export
- `src/pages/AdminDashboard.tsx`: one new row action plus one handler that wires Firestore persistence and admin logs into the shared service

### Task 1: Add Shared Ghost Mode Types And Pure Debug Helpers

**Files:**
- Create: `src/types/adminGhostMode.ts`
- Create: `src/services/dailyJobsEngine.ts`
- Create: `src/services/__tests__/dailyJobsEngine.test.ts`
- Test: `src/services/__tests__/dailyJobsEngine.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/services/__tests__/dailyJobsEngine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildRejectionCodeCounts,
  mapRejectedJobsWithCodes,
  splitJobsBySeenFingerprints,
} from '../dailyJobsEngine';

const acceptedJob = {
  title: 'Senior Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$180k',
  description: 'Build product features',
  url: 'https://jobs.example.com/acme',
  requirements: ['React', 'TypeScript'],
};

const seenJob = {
  title: 'Product Engineer',
  company: 'Orbit',
  location: 'Remote',
  salary: '$170k',
  description: 'Ship product',
  url: 'https://jobs.example.com/orbit',
  requirements: ['React'],
};

describe('mapRejectedJobsWithCodes', () => {
  it('maps validation payloads down to compact code entries', () => {
    const result = mapRejectedJobsWithCodes([
      {
        job: acceptedJob,
        validation: { passed: false, code: 'REMOTE_MISMATCH' },
      },
      {
        job: seenJob,
        validation: { passed: false },
      },
    ]);

    expect(result).toEqual([
      { job: acceptedJob, code: 'REMOTE_MISMATCH' },
      { job: seenJob, code: 'UNKNOWN_REJECTION' },
    ]);
  });
});

describe('buildRejectionCodeCounts', () => {
  it('counts repeated rejection codes', () => {
    const result = buildRejectionCodeCounts([
      { job: acceptedJob, code: 'REMOTE_MISMATCH' },
      { job: seenJob, code: 'REMOTE_MISMATCH' },
      { job: seenJob, code: 'STALE_JOB' },
    ]);

    expect(result).toEqual({
      REMOTE_MISMATCH: 2,
      STALE_JOB: 1,
    });
  });
});

describe('splitJobsBySeenFingerprints', () => {
  it('splits unseen jobs from seen jobs using title-company fingerprints', () => {
    const result = splitJobsBySeenFingerprints(
      [acceptedJob, seenJob],
      ['product engineer::orbit']
    );

    expect(result.unseenJobs).toEqual([acceptedJob]);
    expect(result.seenJobs).toEqual([seenJob]);
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/dailyJobsEngine.test.ts
```

Expected: FAIL because `src/services/dailyJobsEngine.ts` and `src/types/adminGhostMode.ts` do not exist yet.

- [ ] **Step 3: Add the shared Ghost Mode types**

Create `src/types/adminGhostMode.ts`:

```ts
import type { Job } from './dashboard';
import type { ScoutLearningContext } from '../services/learningSignals';

export type GhostModeRunMode = 'preview' | 'persist';
export type GhostModeInputMode = 'saved' | 'override';

export interface GhostModeJob extends Job {
  finalScore?: number;
}

export interface GhostModeRejectedJob {
  job: GhostModeJob;
  code: string;
}

export interface DailyJobsDebugResult {
  queries: string[];
  harvestedCount: number;
  dedupedCount: number;
  validatedCount: number;
  unseenCount: number;
  seenCount: number;
  usedBackfill: boolean;
  acceptedJobs: GhostModeJob[];
  rejectedJobs: GhostModeRejectedJob[];
  rejectionCodeCounts: Record<string, number>;
  finalJobs: GhostModeJob[];
}

export interface GhostModeProfileInput {
  plan?: 'free' | 'pro';
  email?: string;
  careerPaths: string[];
  jobType: string;
  minSalary: number | null;
  resumeText: string;
  location: string;
  seenFingerprints: string[];
  learningContext: string;
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeOverrides {
  careerPaths?: string[];
  jobType?: string;
  minSalary?: number | null;
  resumeText?: string;
  location?: string;
  learningContext?: string;
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeTargetUser {
  id: string;
  email?: string;
  plan?: 'free' | 'pro';
  careerPaths?: string[];
  jobType?: string;
  minSalary?: number | null;
  resumeText?: string;
  location?: string;
  seenJobFingerprints?: string[];
  learningProfile?: {
    jobPreferences?: string;
  };
  learningSignals?: ScoutLearningContext;
}

export interface GhostModeRunResult {
  persisted: boolean;
  requestedLimit: number;
  effectiveProfile: GhostModeProfileInput;
  debug: DailyJobsDebugResult;
}
```

- [ ] **Step 4: Implement the pure debug helpers**

Create `src/services/dailyJobsEngine.ts`:

```ts
import { jobFingerprint } from './serperService';
import type { ValidationResult } from './validator';
import type { GhostModeJob, GhostModeRejectedJob } from '../types/adminGhostMode';

function buildFingerprint(job: { title: string; company: string }) {
  return jobFingerprint(job.title, job.company);
}

export function mapRejectedJobsWithCodes<TJob extends GhostModeJob>(
  rejected: Array<{
    job: TJob;
    validation: ValidationResult;
  }>
): GhostModeRejectedJob[] {
  return rejected.map(({ job, validation }) => ({
    job,
    code: validation.code || 'UNKNOWN_REJECTION',
  }));
}

export function buildRejectionCodeCounts(
  rejectedJobs: GhostModeRejectedJob[]
): Record<string, number> {
  return rejectedJobs.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.code] = (acc[entry.code] || 0) + 1;
    return acc;
  }, {});
}

export function splitJobsBySeenFingerprints<TJob extends GhostModeJob>(
  jobs: TJob[],
  seenFingerprints: string[]
): {
  unseenJobs: TJob[];
  seenJobs: TJob[];
} {
  const seenSet = new Set(seenFingerprints);
  const unseenJobs: TJob[] = [];
  const seenJobs: TJob[] = [];

  for (const job of jobs) {
    const fingerprint = buildFingerprint(job);
    if (seenSet.has(fingerprint)) {
      seenJobs.push(job);
    } else {
      unseenJobs.push(job);
    }
  }

  return { unseenJobs, seenJobs };
}
```

- [ ] **Step 5: Run the helper tests**

Run:

```bash
npm test -- src/services/__tests__/dailyJobsEngine.test.ts
```

Expected: PASS with all helper assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/types/adminGhostMode.ts src/services/dailyJobsEngine.ts src/services/__tests__/dailyJobsEngine.test.ts
git commit -m "feat: add ghost mode debug helpers"
```

### Task 2: Expose A Debug-Capable Daily Jobs Entry Point Without Breaking Existing Callers

**Files:**
- Modify: `src/services/aiService.ts`
- Create: `src/services/__tests__/aiServiceGhostMode.test.ts`
- Test: `src/services/__tests__/aiServiceGhostMode.test.ts`

- [ ] **Step 1: Write the failing compatibility tests**

Create `src/services/__tests__/aiServiceGhostMode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toGenerateDailyJobsResult } from '../aiService';
import type { DailyJobsDebugResult } from '../../types/adminGhostMode';

const debugResult: DailyJobsDebugResult = {
  queries: ['frontend engineer remote react'],
  harvestedCount: 8,
  dedupedCount: 6,
  validatedCount: 4,
  unseenCount: 3,
  seenCount: 1,
  usedBackfill: true,
  acceptedJobs: [],
  rejectedJobs: [],
  rejectionCodeCounts: {},
  finalJobs: [
    {
      title: 'Senior Frontend Engineer',
      company: 'Acme',
      location: 'Remote',
      salary: '$180k',
      description: 'Build product features',
      url: 'https://jobs.example.com/acme',
      requirements: ['React'],
      finalScore: 94,
    },
  ],
};

describe('toGenerateDailyJobsResult', () => {
  it('preserves the existing public return shape for normal callers', () => {
    expect(toGenerateDailyJobsResult(debugResult, 10)).toEqual({
      jobs: debugResult.finalJobs,
      requestedLimit: 10,
      usedBackfill: true,
      totalValidatedJobs: 4,
      unseenCount: 3,
      seenCount: 1,
    });
  });
});
```

- [ ] **Step 2: Run the compatibility tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/aiServiceGhostMode.test.ts
```

Expected: FAIL because `toGenerateDailyJobsResult()` does not exist yet.

- [ ] **Step 3: Add the debug entry point and the compatibility adapter**

Modify `src/services/aiService.ts` to import the new helpers near the existing imports:

```ts
import {
  buildRejectionCodeCounts,
  mapRejectedJobsWithCodes,
  splitJobsBySeenFingerprints,
} from './dailyJobsEngine';
import type { DailyJobsDebugResult } from '../types/adminGhostMode';
```

Add the new adapter and debug export immediately above the current `generateDailyJobs()` implementation:

```ts
export function toGenerateDailyJobsResult(
  debug: DailyJobsDebugResult,
  requestedLimit: number
): GenerateDailyJobsResult {
  return {
    jobs: debug.finalJobs,
    requestedLimit,
    usedBackfill: debug.usedBackfill,
    totalValidatedJobs: debug.validatedCount,
    unseenCount: debug.unseenCount,
    seenCount: debug.seenCount,
  };
}

export async function generateDailyJobsDebug(
  careerPaths: string[],
  jobType: string,
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = [],
  learningContext: string = '',
  location: string = '',
  learningSignals?: ScoutLearningContext
): Promise<DailyJobsDebugResult> {
  const scoutContext: ScoutContext = {
    careerPaths,
    resumeText,
    jobType,
    preferences: {
      remoteOnly: jobType === 'remote',
      salaryFloor: minSalary,
      locations: location ? [location] : [],
    },
    learningContext,
    learningSignals,
    location,
  };

  const generatedQueries = await runWithGuardrails(
    'query_generation',
    buildQueries,
    scoutContext
  );
  const queries = normalizeGeneratedQueries(
    rewriteScoutQueriesWithLearning(generatedQueries, scoutContext.learningSignals)
  );

  const { jobs: harvestedJobs } = await harvestJobs(queries, {
    jobType,
    userLocation: location,
    minSalary,
  });
  const dedupedJobs = dedupeJobsByFingerprint(harvestedJobs);

  const guardrailJobs = dedupedJobs.map(toGuardrailJob);
  const guardrailUser: GuardrailUserContext = {
    preferences: {
      remoteOnly: jobType === 'remote',
      salaryFloor: minSalary,
      locations: location ? [location] : [],
    },
  };

  const jobValidation = await runWithGuardrails(
    'validation',
    async () => validateJobsBeforeAI(guardrailJobs, guardrailUser, 7),
    { expectedCount: guardrailJobs.length }
  );

  const acceptedFingerprints = new Set(
    jobValidation.accepted.map((job) => jobFingerprint(job.title, job.company))
  );
  const acceptedJobs = dedupedJobs.filter((job) =>
    acceptedFingerprints.has(jobFingerprint(job.title, job.company))
  );

  const { unseenJobs, seenJobs } = splitJobsBySeenFingerprints(
    acceptedJobs,
    seenFingerprints
  );

  const unseenRankedJobs = await scoreAndRankJobs(
    unseenJobs,
    careerPaths,
    resumeText,
    limit
  );
  let finalJobs = unseenRankedJobs.slice(0, limit);
  let usedBackfill = false;

  if (finalJobs.length < limit && limit > 1 && seenJobs.length > 0) {
    const backfillRankedJobs = await scoreAndRankJobs(
      seenJobs,
      careerPaths,
      resumeText,
      limit - finalJobs.length
    );
    finalJobs = [
      ...finalJobs,
      ...backfillRankedJobs.slice(0, limit - finalJobs.length),
    ];
    usedBackfill = backfillRankedJobs.length > 0;
  }

  const rejectedJobs = mapRejectedJobsWithCodes(jobValidation.rejected as any);

  return {
    queries,
    harvestedCount: harvestedJobs.length,
    dedupedCount: dedupedJobs.length,
    validatedCount: acceptedJobs.length,
    unseenCount: unseenJobs.length,
    seenCount: seenJobs.length,
    usedBackfill,
    acceptedJobs: acceptedJobs as any,
    rejectedJobs,
    rejectionCodeCounts: buildRejectionCodeCounts(rejectedJobs),
    finalJobs: finalJobs as any,
  };
}
```

Then replace the current `generateDailyJobs()` body with the adapter call:

```ts
export async function generateDailyJobs(
  careerPaths: string[],
  jobType: string,
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = [],
  learningContext: string = '',
  location: string = '',
  learningSignals?: ScoutLearningContext
): Promise<GenerateDailyJobsResult> {
  const debug = await generateDailyJobsDebug(
    careerPaths,
    jobType,
    minSalary,
    resumeText,
    limit,
    seenFingerprints,
    learningContext,
    location,
    learningSignals
  );

  return toGenerateDailyJobsResult(debug, limit);
}
```

- [ ] **Step 4: Run the compatibility tests**

Run:

```bash
npm test -- src/services/__tests__/aiServiceGhostMode.test.ts
```

Expected: PASS with the adapter returning the old public shape.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiService.ts src/services/__tests__/aiServiceGhostMode.test.ts
git commit -m "feat: add debug daily jobs entrypoint"
```

### Task 3: Add Admin Ghost Mode Orchestration For Preview, Persist, And Audit Logging

**Files:**
- Create: `src/services/adminGhostMode.ts`
- Create: `src/services/__tests__/adminGhostMode.test.ts`
- Test: `src/services/__tests__/adminGhostMode.test.ts`

- [ ] **Step 1: Write the failing orchestration tests**

Create `src/services/__tests__/adminGhostMode.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  assertGhostModeProfileReady,
  buildGhostModeProfileInput,
  runAdminGhostMode,
} from '../adminGhostMode';

const targetUser = {
  id: 'user_123',
  email: 'person@example.com',
  plan: 'pro' as const,
  careerPaths: ['Frontend Engineer'],
  jobType: 'remote',
  minSalary: 150000,
  resumeText: 'Built React apps',
  location: 'United States',
  seenJobFingerprints: ['seen role::seen co'],
  learningProfile: { jobPreferences: 'prefers React roles' },
  learningSignals: { likedKeywords: ['react'], dislikedKeywords: ['php'] },
};

const debugResult = {
  queries: ['frontend engineer remote react'],
  harvestedCount: 4,
  dedupedCount: 3,
  validatedCount: 2,
  unseenCount: 1,
  seenCount: 1,
  usedBackfill: false,
  acceptedJobs: [],
  rejectedJobs: [],
  rejectionCodeCounts: {},
  finalJobs: [
    {
      title: 'Frontend Engineer',
      company: 'Acme',
      location: 'Remote',
      salary: '$180k',
      description: 'Build product features',
      url: 'https://jobs.example.com/acme',
      requirements: ['React'],
    },
  ],
};

describe('buildGhostModeProfileInput', () => {
  it('applies override values without mutating the target user', () => {
    const result = buildGhostModeProfileInput(targetUser, 'override', {
      location: 'Germany',
      careerPaths: ['Product Engineer'],
    });

    expect(result.location).toBe('Germany');
    expect(result.careerPaths).toEqual(['Product Engineer']);
    expect(targetUser.location).toBe('United States');
  });
});

describe('assertGhostModeProfileReady', () => {
  it('throws when required career paths are missing', () => {
    expect(() =>
      assertGhostModeProfileReady({
        ...buildGhostModeProfileInput(targetUser, 'saved'),
        careerPaths: [],
      })
    ).toThrow('Career paths are required before running Ghost Mode.');
  });
});

describe('runAdminGhostMode', () => {
  it('does not persist or log during preview runs', async () => {
    const persistDailyJobs = vi.fn();
    const logRun = vi.fn();

    const result = await runAdminGhostMode(
      {
        targetUser,
        admin: { uid: 'admin_1', email: 'admin@example.com' },
        runMode: 'preview',
        inputMode: 'saved',
      },
      {
        generateDebugResult: vi.fn().mockResolvedValue(debugResult),
        persistDailyJobs,
        logRun,
        now: () => '2026-04-16T08:00:00.000Z',
      }
    );

    expect(result.persisted).toBe(false);
    expect(persistDailyJobs).not.toHaveBeenCalled();
    expect(logRun).not.toHaveBeenCalled();
  });

  it('persists results and writes an admin log during persist runs', async () => {
    const persistDailyJobs = vi.fn();
    const logRun = vi.fn();

    await runAdminGhostMode(
      {
        targetUser,
        admin: { uid: 'admin_1', email: 'admin@example.com' },
        runMode: 'persist',
        inputMode: 'override',
        overrides: {
          location: 'Canada',
        },
      },
      {
        generateDebugResult: vi.fn().mockResolvedValue(debugResult),
        persistDailyJobs,
        logRun,
        now: () => '2026-04-16T08:00:00.000Z',
      }
    );

    expect(persistDailyJobs).toHaveBeenCalledWith({
      userId: 'user_123',
      jobs: debugResult.finalJobs,
      lastJobFetchTime: '2026-04-16T08:00:00.000Z',
      seenJobFingerprints: ['seen role::seen co', 'frontend engineer::acme'],
      runDate: '2026-04-16',
    });
    expect(logRun).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'simulate_daily_jobs',
        runMode: 'persist',
        inputMode: 'override',
        overrideKeys: ['location'],
        finalCount: 1,
      })
    );
  });
});
```

- [ ] **Step 2: Run the orchestration tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/adminGhostMode.test.ts
```

Expected: FAIL because `src/services/adminGhostMode.ts` does not exist yet.

- [ ] **Step 3: Implement the Ghost Mode orchestration service**

Create `src/services/adminGhostMode.ts`:

```ts
import { jobFingerprint } from './serperService';
import { getDailyMatchLimit } from '../lib/planLimits';
import type {
  DailyJobsDebugResult,
  GhostModeInputMode,
  GhostModeOverrides,
  GhostModeProfileInput,
  GhostModeRunResult,
  GhostModeRunMode,
  GhostModeTargetUser,
} from '../types/adminGhostMode';

const MAX_SEEN_FINGERPRINTS = 300;

function buildFingerprint(job: { title: string; company: string }) {
  return jobFingerprint(job.title, job.company);
}

export function buildGhostModeProfileInput(
  targetUser: GhostModeTargetUser,
  inputMode: GhostModeInputMode,
  overrides?: GhostModeOverrides
): GhostModeProfileInput {
  const base: GhostModeProfileInput = {
    plan: targetUser.plan,
    email: targetUser.email,
    careerPaths: targetUser.careerPaths || [],
    jobType: targetUser.jobType || 'both',
    minSalary: targetUser.minSalary || null,
    resumeText: targetUser.resumeText || '',
    location: targetUser.location || '',
    seenFingerprints: targetUser.seenJobFingerprints || [],
    learningContext: targetUser.learningProfile?.jobPreferences || '',
    learningSignals: targetUser.learningSignals,
  };

  if (inputMode === 'saved' || !overrides) {
    return base;
  }

  return {
    ...base,
    careerPaths: overrides.careerPaths ?? base.careerPaths,
    jobType: overrides.jobType ?? base.jobType,
    minSalary:
      overrides.minSalary !== undefined ? overrides.minSalary : base.minSalary,
    resumeText: overrides.resumeText ?? base.resumeText,
    location: overrides.location ?? base.location,
    learningContext: overrides.learningContext ?? base.learningContext,
    learningSignals: overrides.learningSignals ?? base.learningSignals,
  };
}

export function assertGhostModeProfileReady(profile: GhostModeProfileInput) {
  if (!profile.careerPaths.length) {
    throw new Error('Career paths are required before running Ghost Mode.');
  }

  if (!profile.resumeText.trim()) {
    throw new Error('Resume text is required before running Ghost Mode.');
  }
}

interface RunAdminGhostModeRequest {
  targetUser: GhostModeTargetUser;
  admin: {
    uid: string;
    email: string;
  };
  runMode: GhostModeRunMode;
  inputMode: GhostModeInputMode;
  overrides?: GhostModeOverrides;
}

interface RunAdminGhostModeDeps {
  generateDebugResult: (
    input: GhostModeProfileInput & { limit: number }
  ) => Promise<DailyJobsDebugResult>;
  persistDailyJobs: (payload: {
    userId: string;
    jobs: DailyJobsDebugResult['finalJobs'];
    lastJobFetchTime: string;
    seenJobFingerprints: string[];
    runDate: string;
  }) => Promise<void>;
  logRun: (payload: Record<string, unknown>) => Promise<void>;
  now?: () => string;
}

export async function runAdminGhostMode(
  request: RunAdminGhostModeRequest,
  deps: RunAdminGhostModeDeps
): Promise<GhostModeRunResult> {
  const effectiveProfile = buildGhostModeProfileInput(
    request.targetUser,
    request.inputMode,
    request.overrides
  );
  assertGhostModeProfileReady(effectiveProfile);

  const requestedLimit = getDailyMatchLimit(effectiveProfile.plan);
  const debug = await deps.generateDebugResult({
    ...effectiveProfile,
    limit: requestedLimit,
  });

  const timestamp = deps.now ? deps.now() : new Date().toISOString();
  const runDate = timestamp.split('T')[0];

  if (request.runMode === 'persist') {
    const nextSeenFingerprints = [
      ...new Set([
        ...effectiveProfile.seenFingerprints,
        ...debug.finalJobs.map((job) => buildFingerprint(job)),
      ]),
    ].slice(-MAX_SEEN_FINGERPRINTS);

    await deps.persistDailyJobs({
      userId: request.targetUser.id,
      jobs: debug.finalJobs,
      lastJobFetchTime: timestamp,
      seenJobFingerprints: nextSeenFingerprints,
      runDate,
    });

    await deps.logRun({
      adminUid: request.admin.uid,
      adminEmail: request.admin.email,
      targetUserId: request.targetUser.id,
      targetUserEmail: request.targetUser.email || '',
      action: 'simulate_daily_jobs',
      runMode: request.runMode,
      inputMode: request.inputMode,
      overrideKeys: Object.keys(request.overrides || {}).filter((key) => {
        const value = request.overrides?.[key as keyof GhostModeOverrides];
        return value !== undefined;
      }),
      acceptedCount: debug.acceptedJobs.length,
      rejectedCount: debug.rejectedJobs.length,
      finalCount: debug.finalJobs.length,
      timestamp,
    });
  }

  return {
    persisted: request.runMode === 'persist',
    requestedLimit,
    effectiveProfile,
    debug,
  };
}
```

- [ ] **Step 4: Run the orchestration tests**

Run:

```bash
npm test -- src/services/__tests__/adminGhostMode.test.ts
```

Expected: PASS with preview safety and persist behavior covered.

- [ ] **Step 5: Commit**

```bash
git add src/services/adminGhostMode.ts src/services/__tests__/adminGhostMode.test.ts
git commit -m "feat: add admin ghost mode orchestration"
```

### Task 4: Build The Admin Ghost Mode Modal And Wire It Into The Dashboard

**Files:**
- Create: `src/components/admin/GhostModeModal.tsx`
- Modify: `src/pages/AdminDashboard.tsx`
- Test: `src/services/__tests__/dailyJobsEngine.test.ts`
- Test: `src/services/__tests__/aiServiceGhostMode.test.ts`
- Test: `src/services/__tests__/adminGhostMode.test.ts`

- [ ] **Step 1: Add the focused modal component**

Create `src/components/admin/GhostModeModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import type {
  GhostModeInputMode,
  GhostModeOverrides,
  GhostModeRunMode,
  GhostModeTargetUser,
} from '../../types/adminGhostMode';

interface GhostModeModalProps {
  open: boolean;
  user: GhostModeTargetUser | null;
  running: boolean;
  result: {
    persisted: boolean;
    requestedLimit: number;
    debug: {
      acceptedJobs: Array<{ title: string; company: string; location: string; finalScore?: number }>;
      rejectedJobs: Array<{ job: { title: string; company: string }; code: string }>;
      rejectionCodeCounts: Record<string, number>;
      queries: string[];
      harvestedCount: number;
      dedupedCount: number;
      validatedCount: number;
      unseenCount: number;
      seenCount: number;
      usedBackfill: boolean;
      finalJobs: Array<{ title: string; company: string }>;
    };
  } | null;
  onClose: () => void;
  onRun: (payload: {
    runMode: GhostModeRunMode;
    inputMode: GhostModeInputMode;
    overrides?: GhostModeOverrides;
  }) => Promise<void>;
}

function buildOverrideState(user: GhostModeTargetUser | null): GhostModeOverrides {
  return {
    careerPaths: user?.careerPaths || [],
    jobType: user?.jobType || 'both',
    location: user?.location || '',
    minSalary: user?.minSalary || null,
    resumeText: user?.resumeText || '',
    learningContext: user?.learningProfile?.jobPreferences || '',
  };
}

export function GhostModeModal({
  open,
  user,
  running,
  result,
  onClose,
  onRun,
}: GhostModeModalProps) {
  const [runMode, setRunMode] = useState<GhostModeRunMode>('preview');
  const [inputMode, setInputMode] = useState<GhostModeInputMode>('saved');
  const [overrides, setOverrides] = useState<GhostModeOverrides>(buildOverrideState(user));

  useEffect(() => {
    if (!open) return;
    setRunMode('preview');
    setInputMode('saved');
    setOverrides(buildOverrideState(user));
  }, [open, user]);

  if (!open || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">Simulate for User</h3>
            <p className="mt-1 text-sm text-foreground-muted">{user.email || 'Unknown user'}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground-muted">Run Mode</label>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2"
              value={runMode}
              onChange={(e) => setRunMode(e.target.value as GhostModeRunMode)}
            >
              <option value="preview">Preview Only</option>
              <option value="persist">Run + Persist</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground-muted">Input Mode</label>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2"
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value as GhostModeInputMode)}
            >
              <option value="saved">Use Saved Profile</option>
              <option value="override">Use Overrides</option>
            </select>
          </div>
        </div>

        {inputMode === 'override' && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <textarea
              className="min-h-[96px] rounded-xl border border-border bg-surface px-3 py-2"
              value={(overrides.careerPaths || []).join(', ')}
              onChange={(e) =>
                setOverrides((current) => ({
                  ...current,
                  careerPaths: e.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                }))
              }
            />
            <textarea
              className="min-h-[96px] rounded-xl border border-border bg-surface px-3 py-2"
              value={overrides.resumeText || ''}
              onChange={(e) =>
                setOverrides((current) => ({
                  ...current,
                  resumeText: e.target.value,
                }))
              }
            />
            <input
              className="rounded-xl border border-border bg-surface px-3 py-2"
              value={overrides.location || ''}
              onChange={(e) =>
                setOverrides((current) => ({
                  ...current,
                  location: e.target.value,
                }))
              }
            />
            <input
              type="number"
              className="rounded-xl border border-border bg-surface px-3 py-2"
              value={overrides.minSalary ?? ''}
              onChange={(e) =>
                setOverrides((current) => ({
                  ...current,
                  minSalary: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={running}>Cancel</Button>
          <Button
            variant="action"
            onClick={() =>
              onRun({
                runMode,
                inputMode,
                overrides: inputMode === 'override' ? overrides : undefined,
              })
            }
            disabled={running}
          >
            {running ? 'Running...' : runMode === 'persist' ? 'Run + Persist' : 'Preview Run'}
          </Button>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-foreground">
              <p>Requested limit: {result.requestedLimit}</p>
              <p>Persisted: {result.persisted ? 'Yes' : 'No'}</p>
              <p>Harvested / Deduped / Validated: {result.debug.harvestedCount} / {result.debug.dedupedCount} / {result.debug.validatedCount}</p>
              <p>Unseen / Seen / Backfill: {result.debug.unseenCount} / {result.debug.seenCount} / {result.debug.usedBackfill ? 'Yes' : 'No'}</p>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-foreground-muted">Rejection Code Counts</p>
              <pre className="whitespace-pre-wrap text-sm text-foreground">
                {JSON.stringify(result.debug.rejectionCodeCounts, null, 2)}
              </pre>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-foreground-muted">Rejected Jobs</p>
              <div className="space-y-2 text-sm text-foreground">
                {result.debug.rejectedJobs.map((entry) => (
                  <p key={`${entry.job.title}-${entry.job.company}`}>
                    {entry.job.title} @ {entry.job.company} - {entry.code}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Ghost Mode into the admin page**

Modify `src/pages/AdminDashboard.tsx` imports:

```ts
import { collection, doc, updateDoc, addDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { generateDailyJobsDebug } from '../services/aiService';
import { runAdminGhostMode } from '../services/adminGhostMode';
import { GhostModeModal } from '../components/admin/GhostModeModal';
import type { GhostModeOverrides, GhostModeRunResult } from '../types/adminGhostMode';
```

Add the new page state near the other modal state:

```ts
const [ghostModeUser, setGhostModeUser] = useState<any>(null);
const [ghostModeRunning, setGhostModeRunning] = useState(false);
const [ghostModeResult, setGhostModeResult] = useState<GhostModeRunResult | null>(null);
```

Add the run handler above the `if (!isAuthenticated)` return:

```ts
const handleRunGhostMode = async (payload: {
  runMode: 'preview' | 'persist';
  inputMode: 'saved' | 'override';
  overrides?: GhostModeOverrides;
}) => {
  if (!ghostModeUser || !currentUser?.uid || !currentUser?.email) {
    toast.error('Admin identity is required to run Ghost Mode.');
    return;
  }

  setGhostModeRunning(true);
  try {
    const result = await runAdminGhostMode(
      {
        targetUser: ghostModeUser,
        admin: {
          uid: currentUser.uid,
          email: currentUser.email,
        },
        runMode: payload.runMode,
        inputMode: payload.inputMode,
        overrides: payload.overrides,
      },
      {
        generateDebugResult: (input) =>
          generateDailyJobsDebug(
            input.careerPaths,
            input.jobType,
            input.minSalary,
            input.resumeText,
            input.limit,
            input.seenFingerprints,
            input.learningContext,
            input.location,
            input.learningSignals
          ),
        persistDailyJobs: async ({
          userId,
          jobs,
          lastJobFetchTime,
          seenJobFingerprints,
          runDate,
        }) => {
          await setDoc(
            doc(db, 'users', userId),
            {
              dailyJobs: jobs,
              lastJobFetchTime,
              seenJobFingerprints,
            },
            { merge: true }
          );

          await setDoc(
            doc(db, 'users', userId, 'daily_matches', runDate),
            {
              jobs,
              fetchedAt: lastJobFetchTime,
            },
            { merge: true }
          );
        },
        logRun: async (entry) => {
          await addDoc(collection(db, 'admin_logs'), entry);
        },
      }
    );

    setGhostModeResult(result);
    toast.success(
      result.persisted
        ? `Persisted ${result.debug.finalJobs.length} jobs for ${ghostModeUser.email}`
        : `Preview ready for ${ghostModeUser.email}`
    );
  } catch (error: any) {
    toast.error(error.message || 'Ghost Mode run failed');
  } finally {
    setGhostModeRunning(false);
  }
};
```

Add the new row action next to the existing admin buttons:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => {
    setGhostModeUser(u);
    setGhostModeResult(null);
  }}
>
  Simulate for User
</Button>
```

Render the modal near the other modal blocks at the end of the page:

```tsx
<GhostModeModal
  open={!!ghostModeUser}
  user={ghostModeUser}
  running={ghostModeRunning}
  result={ghostModeResult}
  onClose={() => {
    setGhostModeUser(null);
    setGhostModeResult(null);
  }}
  onRun={handleRunGhostMode}
/>
```

- [ ] **Step 3: Run the targeted Ghost Mode test set**

Run:

```bash
npm test -- src/services/__tests__/dailyJobsEngine.test.ts src/services/__tests__/aiServiceGhostMode.test.ts src/services/__tests__/adminGhostMode.test.ts
```

Expected: PASS with all Ghost Mode helper, adapter, and orchestration tests green.

- [ ] **Step 4: Run the TypeScript check**

Run:

```bash
npm run lint
```

Expected: PASS with no new TypeScript errors in `AdminDashboard.tsx`, `GhostModeModal.tsx`, or the new services.

- [ ] **Step 5: Perform a manual admin smoke test**

Run:

```bash
npm run dev
```

Expected: Vite starts locally and the admin flow can be checked manually:

- unlock the admin page
- click `Simulate for User`
- confirm `Preview Only` shows rejection codes without writing data
- confirm `Run + Persist` updates the target user cache and keeps email silent
- confirm `Use Overrides` changes the simulated inputs without changing the user record

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/GhostModeModal.tsx src/pages/AdminDashboard.tsx
git commit -m "feat: add admin ghost mode simulator"
```
