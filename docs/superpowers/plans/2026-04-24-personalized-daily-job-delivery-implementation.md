# Personalized Daily Job Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing jobs system so delivery is scheduled per user local time, matching quality uses resume plus career paths plus settings, and the dashboard explains skipped or quality-limited daily runs.

**Architecture:** Keep the existing cron -> per-user processor -> Firestore -> dashboard flow, but add a focused profile/delivery helper, queryable scheduler fields on the user profile, richer run metadata, and tighter matching filters. Use `nextJobDeliveryAt` as a derived field for efficient due-user selection while preserving `deliveryTimezone`, `preferredDeliveryHour`, and local-date idempotency as the source-of-truth scheduling model.

**Tech Stack:** TypeScript, React, Vite, Firebase Firestore, Vercel serverless routes, Vitest

---

## File Map

**Create**
- `src/services/jobDeliveryProfile.ts`
- `src/services/__tests__/jobDeliveryProfile.test.ts`
- `docs/superpowers/plans/2026-04-24-personalized-daily-job-delivery-implementation.md`

**Modify**
- `src/contexts/AuthContext.tsx`
- `src/pages/Settings.tsx`
- `src/services/cronEngine.ts`
- `src/services/jobMatchingEngine.ts`
- `src/services/validator.ts`
- `src/types/dailyJob.ts`
- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `src/hooks/useDashboardJobs.ts`
- `src/components/dashboard/MatchesTab.tsx`

**Test**
- `src/services/__tests__/jobDeliveryProfile.test.ts`
- `src/services/__tests__/cronEngine.test.ts`
- `src/services/__tests__/validator.test.ts`
- `src/components/dashboard/__tests__/MatchesTab.test.ts`

**Why these files**
- `src/services/jobDeliveryProfile.ts` becomes the single place for delivery defaults, local-date scheduling helpers, and profile readiness evaluation.
- `src/contexts/AuthContext.tsx` holds the runtime `UserProfile` shape and new-user defaults.
- `src/pages/Settings.tsx` becomes the only UI for editing delivery timezone, delivery hour, and normalized matching preferences.
- `src/services/cronEngine.ts` keeps queueing and per-user processing rules together, including due-user selection and idempotency.
- `api/cron/daily-alerts.ts` stays a thin dispatcher that queries due users and fires per-user processing.
- `api/cron/process-user.ts` stays the composition layer that loads the profile, runs research/matching, stores results, and sends email.
- `src/hooks/useDashboardJobs.ts` and `src/components/dashboard/MatchesTab.tsx` surface run metadata without reimplementing backend logic.

---

### Task 1: Add Delivery Profile Helpers And Tests

**Files:**
- Create: `src/services/jobDeliveryProfile.ts`
- Test: `src/services/__tests__/jobDeliveryProfile.test.ts`
- Verify: `src/services/validator.ts`

- [ ] **Step 1: Write the failing test for defaults, readiness, and due-user evaluation**

Create `src/services/__tests__/jobDeliveryProfile.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  computeMatchReadiness,
  computeNextJobDeliveryAt,
  evaluateDueDailyRun,
  normalizeDeliverySettings,
} from '../jobDeliveryProfile';

describe('normalizeDeliverySettings', () => {
  it('defaults to UTC and 8 AM when settings are missing', () => {
    expect(normalizeDeliverySettings({})).toEqual({
      deliveryTimezone: 'UTC',
      preferredDeliveryHour: 8,
    });
  });
});

describe('computeMatchReadiness', () => {
  it('blocks when both resume text and career paths are missing', () => {
    expect(
      computeMatchReadiness({
        resumeText: '',
        careerPaths: [],
      })
    ).toEqual(
      expect.objectContaining({
        status: 'blocked',
        hasResume: false,
        hasCareerPaths: false,
      })
    );
  });

  it('marks the profile partial when career paths exist without a usable resume', () => {
    expect(
      computeMatchReadiness({
        resumeText: 'short',
        careerPaths: ['Frontend Engineer'],
      })
    ).toEqual(
      expect.objectContaining({
        status: 'partial',
        hasCareerPaths: true,
      })
    );
  });
});

describe('evaluateDueDailyRun', () => {
  it('returns due when local time has passed the preferred hour and no success exists for that date', () => {
    const result = evaluateDueDailyRun(
      {
        deliveryTimezone: 'Asia/Kolkata',
        preferredDeliveryHour: 8,
        lastSuccessfulJobRunLocalDate: '2026-04-23',
      },
      new Date('2026-04-24T03:00:00.000Z')
    );

    expect(result).toEqual(
      expect.objectContaining({
        due: true,
        localDate: '2026-04-24',
      })
    );
  });

  it('returns not due when the user already completed the local day', () => {
    const result = evaluateDueDailyRun(
      {
        deliveryTimezone: 'Asia/Kolkata',
        preferredDeliveryHour: 8,
        lastSuccessfulJobRunLocalDate: '2026-04-24',
      },
      new Date('2026-04-24T03:00:00.000Z')
    );

    expect(result).toEqual(
      expect.objectContaining({
        due: false,
        reason: 'ALREADY_COMPLETED',
      })
    );
  });
});

describe('computeNextJobDeliveryAt', () => {
  it('returns an ISO timestamp after the current successful run window', () => {
    const next = computeNextJobDeliveryAt('Asia/Kolkata', 8, new Date('2026-04-24T03:00:00.000Z'));
    expect(next).toBe('2026-04-25T02:30:00.000Z');
  });
});
```

- [ ] **Step 2: Run the new test to verify the helper file does not exist yet**

Run:

```bash
npx vitest run src/services/__tests__/jobDeliveryProfile.test.ts
```

Expected: FAIL with a module resolution error for `../jobDeliveryProfile`.

- [ ] **Step 3: Create the delivery helper module**

Create `src/services/jobDeliveryProfile.ts` with:

```ts
import { normalizeUserPreferences, type NormalizedUserPreferences } from './validator';

export interface DeliverySettingsInput {
  deliveryTimezone?: string;
  preferredDeliveryHour?: unknown;
}

export interface MatchReadiness {
  status: 'ready' | 'partial' | 'blocked';
  hasResume: boolean;
  hasCareerPaths: boolean;
  blockingReason: string | null;
  qualityWarnings: string[];
}

export interface DueDailyRunResult {
  due: boolean;
  localDate: string;
  localHour: number;
  nextDeliveryAt: string;
  reason?: 'NOT_DUE_YET' | 'ALREADY_COMPLETED';
}

export function normalizeDeliverySettings(input: DeliverySettingsInput): {
  deliveryTimezone: string;
  preferredDeliveryHour: number;
} {
  const deliveryTimezone = (input.deliveryTimezone || '').trim() || 'UTC';
  const parsedHour =
    typeof input.preferredDeliveryHour === 'number'
      ? input.preferredDeliveryHour
      : typeof input.preferredDeliveryHour === 'string'
        ? Number.parseInt(input.preferredDeliveryHour, 10)
        : 8;

  const preferredDeliveryHour =
    Number.isFinite(parsedHour) && parsedHour >= 0 && parsedHour <= 23
      ? parsedHour
      : 8;

  return { deliveryTimezone, preferredDeliveryHour };
}

export function buildMatchingPreferences(profile: {
  matchingPreferences?: NormalizedUserPreferences;
  preferences?: unknown;
  jobType?: string;
  minSalary?: number | null;
  location?: string;
}): NormalizedUserPreferences {
  if (profile.matchingPreferences) return profile.matchingPreferences;

  return normalizeUserPreferences(
    profile.preferences || {
      remoteOnly: profile.jobType === 'remote',
      salaryFloor: profile.minSalary,
      locations: profile.location ? [profile.location] : [],
    }
  );
}

export function computeMatchReadiness(profile: {
  resumeText?: string;
  careerPaths?: string[];
}): MatchReadiness {
  const resumeText = (profile.resumeText || '').trim();
  const careerPaths = Array.isArray(profile.careerPaths)
    ? profile.careerPaths.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];

  const hasResume = resumeText.length >= 50;
  const hasCareerPaths = careerPaths.length > 0;

  if (!hasResume && !hasCareerPaths) {
    return {
      status: 'blocked',
      hasResume,
      hasCareerPaths,
      blockingReason: 'Profile missing usable resume text and career paths.',
      qualityWarnings: [],
    };
  }

  if (!hasResume && hasCareerPaths) {
    return {
      status: 'partial',
      hasResume,
      hasCareerPaths,
      blockingReason: null,
      qualityWarnings: ['Resume text is missing or too short; matching quality may be limited.'],
    };
  }

  return {
    status: 'ready',
    hasResume,
    hasCareerPaths,
    blockingReason: null,
    qualityWarnings: [],
  };
}

function getLocalParts(timeZone: string, now: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: Number.parseInt(get('year') || '0', 10),
    month: Number.parseInt(get('month') || '0', 10),
    day: Number.parseInt(get('day') || '0', 10),
    hour: Number.parseInt(get('hour') || '0', 10),
    minute: Number.parseInt(get('minute') || '0', 10),
    second: Number.parseInt(get('second') || '0', 10),
  };
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const local = getLocalParts(timeZone, date);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    0
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
  const offsetMs = getTimeZoneOffsetMs(timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offsetMs);
}

export function computeNextJobDeliveryAt(
  deliveryTimezone: string,
  preferredDeliveryHour: number,
  now: Date = new Date()
): string {
  const local = getLocalParts(deliveryTimezone, now);
  let target = zonedDateTimeToUtc(
    deliveryTimezone,
    local.year,
    local.month,
    local.day,
    preferredDeliveryHour
  );

  if (target.getTime() <= now.getTime()) {
    const nextLocal = getLocalParts(deliveryTimezone, new Date(target.getTime() + 36 * 60 * 60 * 1000));
    target = zonedDateTimeToUtc(
      deliveryTimezone,
      nextLocal.year,
      nextLocal.month,
      nextLocal.day,
      preferredDeliveryHour
    );
  }

  return target.toISOString();
}

export function evaluateDueDailyRun(
  profile: DeliverySettingsInput & { lastSuccessfulJobRunLocalDate?: string },
  now: Date = new Date()
): DueDailyRunResult {
  const { deliveryTimezone, preferredDeliveryHour } = normalizeDeliverySettings(profile);
  const local = getLocalParts(deliveryTimezone, now);
  const localDate = [
    String(local.year).padStart(4, '0'),
    String(local.month).padStart(2, '0'),
    String(local.day).padStart(2, '0'),
  ].join('-');
  const nextDeliveryAt = computeNextJobDeliveryAt(deliveryTimezone, preferredDeliveryHour, now);

  if (profile.lastSuccessfulJobRunLocalDate === localDate) {
    return { due: false, localDate, localHour: local.hour, nextDeliveryAt, reason: 'ALREADY_COMPLETED' };
  }

  if (local.hour < preferredDeliveryHour) {
    return { due: false, localDate, localHour: local.hour, nextDeliveryAt, reason: 'NOT_DUE_YET' };
  }

  return { due: true, localDate, localHour: local.hour, nextDeliveryAt };
}
```

- [ ] **Step 4: Run the new helper test and the existing validator test**

Run:

```bash
npx vitest run src/services/__tests__/jobDeliveryProfile.test.ts src/services/__tests__/validator.test.ts
```

Expected: PASS for the new helper tests and no regression in validator helpers.

- [ ] **Step 5: Commit the helper foundation**

```bash
git add src/services/jobDeliveryProfile.ts src/services/__tests__/jobDeliveryProfile.test.ts
git commit -m "feat: add job delivery profile helpers"
```

---

### Task 2: Extend User Profile Types And Settings Persistence

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/pages/Settings.tsx`
- Verify: `src/services/validator.ts`

- [ ] **Step 1: Add the new profile fields to `UserProfile`**

Update `src/contexts/AuthContext.tsx` so `UserProfile` includes:

```ts
export interface MatchReadinessSnapshot {
  status: 'ready' | 'partial' | 'blocked';
  hasResume: boolean;
  hasCareerPaths: boolean;
  blockingReason: string | null;
  qualityWarnings: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  careerPaths?: string[];
  jobType?: string;
  location?: string;
  minSalary?: number | null;
  resumeText?: string;
  resumeRaw?: string;
  resumeCleaned?: string;
  resumeSummary?: string;
  structuredProfile?: StructuredProfile;
  preferences?: UserPreferences;
  matchingPreferences?: UserPreferences;
  deliveryTimezone?: string;
  preferredDeliveryHour?: number;
  nextJobDeliveryAt?: string;
  lastSuccessfulJobRunLocalDate?: string;
  matchReadiness?: MatchReadinessSnapshot;
  resumeAnalysis?: ResumeAnalysis;
  plan?: 'free' | 'pro';
  receiveDailyAlerts?: boolean;
  antiSlopEnabled?: boolean;
  dailyJobs?: any[];
  dailyJobsMeta?: Record<string, any>;
  lastJobFetchTime?: string;
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
  learningProfile?: LearningProfile;
  learningSignals?: LearningSignals;
}
```

- [ ] **Step 2: Add sane defaults for new users**

In the new-profile branch of `src/contexts/AuthContext.tsx`, set:

```ts
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const newProfile: UserProfile = {
  uid: currentUser.uid,
  email: currentUser.email || '',
  displayName: currentUser.displayName || '',
  photoURL: currentUser.photoURL || '',
  plan: 'free',
  receiveDailyAlerts: true,
  antiSlopEnabled: true,
  deliveryTimezone: browserTimeZone,
  preferredDeliveryHour: 8,
  nextJobDeliveryAt: new Date().toISOString(),
  matchReadiness: {
    status: 'blocked',
    hasResume: false,
    hasCareerPaths: false,
    blockingReason: 'Profile missing usable resume text and career paths.',
    qualityWarnings: [],
  },
  createdAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  lastJobFetchTime: '1970-01-01T00:00:00.000Z',
};
```

- [ ] **Step 3: Extend settings form state for delivery controls**

In `src/pages/Settings.tsx`, add:

```ts
const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const [formData, setFormData] = useState({
  careerPaths: [] as string[],
  jobType: 'both',
  location: '',
  minSalary: '',
  resumeText: '',
  resumeAnalysis: undefined as any,
  receiveDailyAlerts: true,
  antiSlopEnabled: true,
  deliveryTimezone: DEFAULT_TIMEZONE,
  preferredDeliveryHour: '8',
});
```

and hydrate it from `profile`:

```ts
deliveryTimezone: profile.deliveryTimezone || DEFAULT_TIMEZONE,
preferredDeliveryHour: String(profile.preferredDeliveryHour ?? 8),
```

- [ ] **Step 4: Save normalized matching and delivery fields together**

At the top of `handleSave()` in `src/pages/Settings.tsx`, import and use the new helpers:

```ts
import {
  computeMatchReadiness,
  computeNextJobDeliveryAt,
  normalizeDeliverySettings,
} from '../services/jobDeliveryProfile';
```

Then compute and persist:

```ts
const preferences = normalizeUserPreferences({
  remoteOnly: formData.jobType === 'remote',
  salaryFloor: formData.minSalary,
  locations: formData.location ? [formData.location] : [],
});
const legacy = syncLegacyPreferenceFields(preferences);
const delivery = normalizeDeliverySettings({
  deliveryTimezone: formData.deliveryTimezone,
  preferredDeliveryHour: formData.preferredDeliveryHour,
});
const matchReadiness = computeMatchReadiness({
  resumeText: formData.resumeText,
  careerPaths: formData.careerPaths,
});
const nextJobDeliveryAt = computeNextJobDeliveryAt(
  delivery.deliveryTimezone,
  delivery.preferredDeliveryHour
);

await updateProfile({
  careerPaths: formData.careerPaths,
  preferences,
  matchingPreferences: preferences,
  jobType: legacy.jobType,
  location: legacy.location,
  minSalary: legacy.minSalary,
  deliveryTimezone: delivery.deliveryTimezone,
  preferredDeliveryHour: delivery.preferredDeliveryHour,
  nextJobDeliveryAt,
  matchReadiness,
  receiveDailyAlerts: formData.receiveDailyAlerts,
  antiSlopEnabled: formData.antiSlopEnabled,
});
```

- [ ] **Step 5: Add the new controls and verify the page still compiles**

Add this block under “Job Preferences” in `src/pages/Settings.tsx`:

```tsx
<div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <label className="text-sm font-medium text-foreground-muted">Delivery Timezone</label>
    <Input
      name="deliveryTimezone"
      value={formData.deliveryTimezone}
      onChange={handleChange}
      placeholder="Asia/Kolkata"
    />
  </div>
  <div className="space-y-2">
    <label className="text-sm font-medium text-foreground-muted">Preferred Delivery Hour</label>
    <select
      name="preferredDeliveryHour"
      value={formData.preferredDeliveryHour}
      onChange={handleChange}
      className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
    >
      {Array.from({ length: 24 }, (_, hour) => (
        <option key={hour} value={String(hour)}>
          {hour.toString().padStart(2, '0')}:00
        </option>
      ))}
    </select>
  </div>
</div>
```

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no new type errors in `AuthContext.tsx` or `Settings.tsx`.

- [ ] **Step 6: Commit the profile/settings changes**

```bash
git add src/contexts/AuthContext.tsx src/pages/Settings.tsx
git commit -m "feat: add delivery preferences to user profile"
```

---

### Task 3: Make The Dispatcher Query Due Users In Local Time

**Files:**
- Modify: `src/services/cronEngine.ts`
- Modify: `api/cron/daily-alerts.ts`
- Test: `src/services/__tests__/cronEngine.test.ts`

- [ ] **Step 1: Add failing cron-engine tests for due-user selection**

Append to `src/services/__tests__/cronEngine.test.ts`:

```ts
import { evaluateDueUsers, type CronEligibleUser } from '../cronEngine';

describe('evaluateDueUsers', () => {
  it('selects only users whose next delivery time is due', () => {
    const result = evaluateDueUsers(
      [
        {
          id: 'due_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            deliveryTimezone: 'Asia/Kolkata',
            preferredDeliveryHour: 8,
            nextJobDeliveryAt: '2026-04-24T02:30:00.000Z',
          },
        },
        {
          id: 'later_user',
          data: {
            plan: 'pro',
            receiveDailyAlerts: true,
            deliveryTimezone: 'America/New_York',
            preferredDeliveryHour: 12,
            nextJobDeliveryAt: '2026-04-24T16:00:00.000Z',
          },
        },
      ],
      new Date('2026-04-24T03:00:00.000Z')
    );

    expect(result.due.map((user) => user.id)).toEqual(['due_user']);
    expect(result.skipped.map((user) => user.id)).toEqual(['later_user']);
  });
});
```

- [ ] **Step 2: Run the cron-engine test to verify the new export does not exist yet**

Run:

```bash
npx vitest run src/services/__tests__/cronEngine.test.ts
```

Expected: FAIL with `evaluateDueUsers` missing.

- [ ] **Step 3: Add due-user evaluation helpers to `cronEngine.ts`**

Add these exports in `src/services/cronEngine.ts`:

```ts
import {
  computeMatchReadiness,
  computeNextJobDeliveryAt,
  evaluateDueDailyRun,
} from './jobDeliveryProfile';

export interface CronEligibleUser {
  plan?: string;
  receiveDailyAlerts?: boolean;
  deliveryTimezone?: string;
  preferredDeliveryHour?: number;
  nextJobDeliveryAt?: string;
  lastSuccessfulJobRunLocalDate?: string;
}

export interface LoadedCronUser {
  id: string;
  data: Record<string, any>;
}

export function evaluateDueUsers(
  users: LoadedCronUser[],
  now: Date = new Date()
) {
  const due: LoadedCronUser[] = [];
  const skipped: LoadedCronUser[] = [];

  for (const user of users) {
    if (!isActiveCronUser(user.data)) {
      skipped.push(user);
      continue;
    }

    if (user.data.nextJobDeliveryAt && user.data.nextJobDeliveryAt > now.toISOString()) {
      skipped.push(user);
      continue;
    }

    const dueResult = evaluateDueDailyRun(user.data, now);
    if (dueResult.due) {
      due.push({
        ...user,
        data: {
          ...user.data,
          deliveryLocalDate: dueResult.localDate,
          nextJobDeliveryAt: dueResult.nextDeliveryAt,
        },
      });
    } else {
      skipped.push(user);
    }
  }

  return { due, skipped };
}
```

- [ ] **Step 4: Replace stale-first dispatch with due-user querying**

In `api/cron/daily-alerts.ts`, replace the dual `orderBy('lastJobFetchTime')` query block with:

```ts
const now = new Date();
const dueSnapshot = await db
  .collection('users')
  .where('nextJobDeliveryAt', '<=', now.toISOString())
  .orderBy('nextJobDeliveryAt', 'asc')
  .limit(DISPATCH_BATCH_SIZE)
  .get();

const { due, skipped: skippedUsers } = evaluateDueUsers(
  dueSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data(),
  })),
  now
);
```

and then iterate over `due`:

```ts
for (const loadedUser of due) {
  const profile = loadedUser.data;

  const queueResult = await queueCronRun(
    {
      userId: loadedUser.id,
      runDate: profile.deliveryLocalDate,
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
          dispatchSource: 'daily-alerts-v3',
          deliveryTimezone: profile.deliveryTimezone || 'UTC',
          createdAt: new Date().toISOString(),
        });
        return true;
      },
    }
  );
}
```

Also increment `skipped` with `skippedUsers.length` before the loop.

- [ ] **Step 5: Run the cron-engine tests and commit**

Run:

```bash
npx vitest run src/services/__tests__/cronEngine.test.ts
```

Expected: PASS, including the new due-user selection test.

Commit:

```bash
git add src/services/cronEngine.ts api/cron/daily-alerts.ts src/services/__tests__/cronEngine.test.ts
git commit -m "feat: schedule daily jobs by user local delivery time"
```

---

### Task 4: Add Readiness, Metadata, And Idempotency To Per-User Processing

**Files:**
- Modify: `src/services/cronEngine.ts`
- Modify: `api/cron/process-user.ts`
- Modify: `src/types/dailyJob.ts`
- Test: `src/services/__tests__/cronEngine.test.ts`

- [ ] **Step 1: Add failing tests for readiness skip and successful local-date persistence**

Append to `src/services/__tests__/cronEngine.test.ts`:

```ts
it('marks blocked profiles as skipped using matchReadiness', async () => {
  const deps = {
    loadUser: vi.fn().mockResolvedValue({
      id: 'user_123',
      data: {
        plan: 'pro',
        receiveDailyAlerts: true,
        deliveryTimezone: 'Asia/Kolkata',
        preferredDeliveryHour: 8,
        matchReadiness: {
          status: 'blocked',
          hasResume: false,
          hasCareerPaths: false,
          blockingReason: 'Profile missing usable resume text and career paths.',
          qualityWarnings: [],
        },
      },
    }),
    getExistingRun: vi.fn().mockResolvedValue({ id: 'user_123_2026-04-24', status: 'queued' }),
    markRun: vi.fn().mockResolvedValue(undefined),
    generateJobs: vi.fn(),
    storeJobs: vi.fn(),
    sendDailyEmail: vi.fn(),
  };

  const result = await processUserCronRun({ userId: 'user_123', runDate: '2026-04-24' }, deps as any);

  expect(result.status).toBe('skipped');
  expect(deps.generateJobs).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Extend the daily record type with delivery metadata**

In `src/types/dailyJob.ts`, add:

```ts
export interface DailyMatchRecord {
  userId: string;
  date: string;
  generatedAt: string;
  jobs: DailyJob[];
  jobCount: number;
  sources: Record<JobSource, number>;
  requestedLimit: number;
  returnedCount: number;
  qualityFilteredCount: number;
  dedupedCount: number;
  deliveryTimezone: string;
  deliveryLocalDate: string;
  emailSent: boolean;
  qualityLimited: boolean;
  skipReason?: string;
  warnings?: string[];
}
```

- [ ] **Step 3: Use readiness and local-date metadata inside `processUserCronRun`**

In `src/services/cronEngine.ts`, import the helper and update the early validation block:

```ts
const readiness =
  profile.matchReadiness && profile.matchReadiness.status
    ? profile.matchReadiness
    : computeMatchReadiness(profile);

if (readiness.status === 'blocked') {
  await deps.markRun(runId, {
    status: 'skipped',
    completedAt: new Date().toISOString(),
    failureReason: readiness.blockingReason || 'Profile is not ready for matching',
  });
  return { runId, status: 'skipped' as const };
}
```

Then keep readiness warnings in the effective profile:

```ts
const effectiveProfile = {
  ...profile,
  careerPaths: effectiveCareerPaths.length > 0 ? effectiveCareerPaths : profile.careerPaths || [],
  matchReadiness: readiness,
};
```

- [ ] **Step 4: Store richer metadata and next delivery fields in `api/cron/process-user.ts`**

Inside `storeJobs` in `api/cron/process-user.ts`, replace the current user write with:

```ts
const deliveryTimezone = profile.deliveryTimezone || 'UTC';
const preferredDeliveryHour = profile.preferredDeliveryHour ?? 8;
const requestedLimit = generated.requestedLimit ?? jobs.length;
const qualityFilteredCount = generated.qualityFilteredCount ?? 0;
const dedupedCount = generated.dedupedCount ?? 0;
const qualityLimited = jobs.length < requestedLimit;
const warnings = profile.matchReadiness?.qualityWarnings || [];

await db.collection('users').doc(uid).set(
  {
    dailyJobs: jobs,
    dailyJobsMeta: {
      requestedLimit,
      returnedCount: jobs.length,
      qualityFilteredCount,
      dedupedCount,
      deliveryTimezone,
      deliveryLocalDate: date,
      emailSent: false,
      qualityLimited,
      warnings,
    },
    lastJobFetchTime: fetchedAt,
    lastSuccessfulJobRunLocalDate: date,
    nextJobDeliveryAt: computeNextJobDeliveryAt(deliveryTimezone, preferredDeliveryHour, new Date(fetchedAt)),
    matchReadiness: profile.matchReadiness,
    seenJobFingerprints: nextFingerprints,
  },
  { merge: true }
);
```

Then write the same metadata to the `daily_matches` subdocument:

```ts
await db
  .collection('users')
  .doc(uid)
  .collection('daily_matches')
  .doc(date)
  .set({
    userId: uid,
    date,
    generatedAt: fetchedAt,
    jobs,
    jobCount: jobs.length,
    sources,
    requestedLimit,
    returnedCount: jobs.length,
    qualityFilteredCount,
    dedupedCount,
    deliveryTimezone,
    deliveryLocalDate: date,
    emailSent: false,
    qualityLimited,
    warnings,
  });
```

- [ ] **Step 5: Update email success bookkeeping and run the tests**

After successful email send in `api/cron/process-user.ts`, add:

```ts
await db.collection('users').doc(uid).set(
  {
    dailyJobsMeta: { emailSent: true },
  },
  { merge: true }
);
```

Run:

```bash
npx vitest run src/services/__tests__/cronEngine.test.ts
```

Expected: PASS for readiness-based skip and existing completion-order checks.

- [ ] **Step 6: Commit the processor metadata changes**

```bash
git add src/services/cronEngine.ts api/cron/process-user.ts src/types/dailyJob.ts src/services/__tests__/cronEngine.test.ts
git commit -m "feat: record delivery metadata for daily job runs"
```

---

### Task 5: Tighten Matching With Canonical Preferences And Quality Metrics

**Files:**
- Modify: `src/services/jobMatchingEngine.ts`
- Modify: `src/services/validator.ts`
- Test: `src/services/__tests__/validator.test.ts`

- [ ] **Step 1: Add a failing validator test for matching-preferences fallback**

Append to `src/services/__tests__/validator.test.ts`:

```ts
import { normalizeUserPreferences } from '../validator';

it('normalizes remote-only matching preferences from the new canonical object', () => {
  const normalized = normalizeUserPreferences({
    remoteOnly: true,
    salaryFloor: 150000,
    locations: ['Remote', 'New York, NY'],
  });

  expect(normalized).toEqual({
    remoteOnly: true,
    salaryFloor: 150000,
    locations: ['Remote', 'New York, NY'],
  });
});
```

- [ ] **Step 2: Thread normalized preferences into job matching**

At the top of `src/services/jobMatchingEngine.ts`, add:

```ts
import { jobMatchesUserPreferences, normalizeUserPreferences } from './validator';
```

Then extend the options type:

```ts
export interface MatchOptions {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;
  seenFingerprints?: string[];
  limit?: number;
  minMatchScore?: number;
  matchingPreferences?: {
    remoteOnly?: boolean;
    salaryFloor?: number | null;
    locations?: string[];
  };
}
```

and replace the scored filtering section with:

```ts
const normalizedPreferences = normalizeUserPreferences(opts.matchingPreferences || {});

const scored = unseenJobs
  .map((job, idx) => ({
    job,
    matchScore: scores[idx]?.matchScore ?? keywordMatchScore(job, careerPaths, resumeText),
  }))
  .filter(({ job, matchScore }) => {
    if (matchScore < minMatchScore) return false;

    const preferenceResult = jobMatchesUserPreferences(
      {
        isRemote: job.workType === 'remote' || job.location.toLowerCase().includes('remote'),
        salary: job.salary,
        location: job.location,
      },
      normalizedPreferences
    );

    return preferenceResult.passed;
  })
  .sort((a, b) => b.matchScore - a.matchScore);
```

- [ ] **Step 3: Return quality metrics from the ranking function**

Change `MatchResult` in `src/services/jobMatchingEngine.ts` to:

```ts
export interface MatchResult {
  jobs: DailyJob[];
  usedFallback: boolean;
  enrichedCount: number;
  scoredCount: number;
  qualityFilteredCount: number;
  dedupedCount: number;
}
```

and return:

```ts
return {
  jobs: final,
  usedFallback,
  enrichedCount: enriched.length,
  scoredCount: scored.length,
  qualityFilteredCount: Math.max(0, unseenJobs.length - scored.length),
  dedupedCount: Math.max(0, discoveredJobs.length - unseenJobs.length),
};
```

- [ ] **Step 4: Pass canonical matching preferences from the processor**

In `api/cron/process-user.ts`, change the `matchAndRankJobs()` call to:

```ts
const matchResult = await matchAndRankJobs(
  discovered,
  {
    careerPaths,
    resumeText,
    jobType,
    seenFingerprints,
    limit,
    matchingPreferences: profile.matchingPreferences || profile.preferences,
  },
  callAI
);
```

and expose the new metrics in the returned object:

```ts
return {
  jobs: matchResult.jobs,
  requestedLimit: limit,
  usedBackfill: matchResult.usedFallback,
  totalValidatedJobs: matchResult.scoredCount,
  unseenCount: matchResult.scoredCount,
  seenCount: 0,
  qualityFilteredCount: matchResult.qualityFilteredCount,
  dedupedCount: matchResult.dedupedCount,
};
```

- [ ] **Step 5: Run the validator and cron tests, then commit**

Run:

```bash
npx vitest run src/services/__tests__/validator.test.ts src/services/__tests__/cronEngine.test.ts
```

Expected: PASS with no regression in preference normalization and cron orchestration.

Commit:

```bash
git add src/services/jobMatchingEngine.ts src/services/validator.ts api/cron/process-user.ts src/services/__tests__/validator.test.ts
git commit -m "feat: filter job matches with canonical preferences"
```

---

### Task 6: Surface Delivery Metadata In The Dashboard Hook And Matches UI

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Test: `src/components/dashboard/__tests__/MatchesTab.test.ts`

- [ ] **Step 1: Add a failing UI test for delivery messaging**

Append to `src/components/dashboard/__tests__/MatchesTab.test.ts`:

```ts
it('renders next-delivery and quality-limited messages when metadata is provided', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(MatchesTab, {
        plan: 'pro',
        jobs: [sampleJob],
        loadingJobs: false,
        fetchJobs: () => {},
        filterCompany: '',
        setFilterCompany: () => {},
        filterLocation: '',
        setFilterLocation: () => {},
        filterSalary: '',
        setFilterSalary: () => {},
        filterWorkType: 'all',
        setFilterWorkType: () => {},
        sortBy: 'matchScore',
        setSortBy: () => {},
        selectedJob: null,
        setSelectedJob: () => {},
        setAiAction: () => {},
        saveJob: async () => true,
        savedJobFingerprints: [],
        dismissJob: () => {},
        dailyJobsMeta: {
          requestedLimit: 10,
          returnedCount: 1,
          qualityLimited: true,
          warnings: ['Resume text is missing or too short; matching quality may be limited.'],
        },
        nextJobDeliveryAt: '2026-04-25T02:30:00.000Z',
      })
    )
  );

  expect(html).toContain('Next delivery');
  expect(html).toContain('Only 1 strong match found today');
  expect(html).toContain('matching quality may be limited');
});
```

- [ ] **Step 2: Extend the hook to return batch metadata**

In `src/hooks/useDashboardJobs.ts`, add state:

```ts
const [dailyJobsMeta, setDailyJobsMeta] = useState<Record<string, any> | null>(null);
```

and when loading daily matches from Firestore:

```ts
if (dailySnap.exists()) {
  const record = dailySnap.data();
  const fetched: DailyJob[] = (record.jobs || []).slice(0, limit);
  setJobs(fetched);
  setDailyJobsMeta({
    requestedLimit: record.requestedLimit ?? limit,
    returnedCount: record.returnedCount ?? fetched.length,
    qualityFilteredCount: record.qualityFilteredCount ?? 0,
    dedupedCount: record.dedupedCount ?? 0,
    qualityLimited: record.qualityLimited === true,
    warnings: record.warnings || [],
    deliveryTimezone: record.deliveryTimezone || profile.deliveryTimezone || 'UTC',
    deliveryLocalDate: record.deliveryLocalDate || today,
    emailSent: record.emailSent === true,
  });
  setLastFetchTime(record.generatedAt || today);
  foundInDaily = true;
}
```

For the user-doc cache fallback:

```ts
setDailyJobsMeta(profile.dailyJobsMeta || null);
```

and return:

```ts
dailyJobsMeta,
nextJobDeliveryAt: profile?.nextJobDeliveryAt || null,
matchReadiness: profile?.matchReadiness || null,
```

- [ ] **Step 3: Extend `MatchesTab` props and render metadata**

In `src/components/dashboard/MatchesTab.tsx`, add props:

```ts
dailyJobsMeta?: {
  requestedLimit?: number;
  returnedCount?: number;
  qualityLimited?: boolean;
  warnings?: string[];
} | null;
nextJobDeliveryAt?: string | null;
```

Then render a lightweight status block above the list:

```tsx
{(dailyJobsMeta || nextJobDeliveryAt) && (
  <div className="mb-4 rounded-2xl border border-border bg-surface p-4 text-sm text-foreground-muted">
    {nextJobDeliveryAt && (
      <p>
        <span className="font-medium text-foreground">Next delivery:</span>{' '}
        {new Date(nextJobDeliveryAt).toLocaleString()}
      </p>
    )}
    {dailyJobsMeta?.qualityLimited && (
      <p className="mt-1">
        Only {dailyJobsMeta.returnedCount ?? jobs.length} strong match
        {(dailyJobsMeta.returnedCount ?? jobs.length) === 1 ? '' : 'es'} found today.
      </p>
    )}
    {(dailyJobsMeta?.warnings || []).map((warning) => (
      <p key={warning} className="mt-1">{warning}</p>
    ))}
  </div>
)}
```

- [ ] **Step 4: Thread the new hook data through the dashboard**

In `src/pages/Dashboard.tsx`, destructure:

```ts
const {
  filteredAndSortedJobs,
  loadingJobs,
  generatingJobs,
  requestJobs,
  stats,
  statsLoading,
  fetchJobs,
  saveJob,
  dismissJob,
  trackJobClick,
  filterCompany,
  setFilterCompany,
  filterLocation,
  setFilterLocation,
  filterSalary,
  setFilterSalary,
  filterWorkType,
  setFilterWorkType,
  sortBy,
  setSortBy,
  lastFetchTime,
  dailyJobsMeta,
  nextJobDeliveryAt,
} = useDashboardJobs(user, profile, updateProfile);
```

and pass:

```tsx
dailyJobsMeta={dailyJobsMeta}
nextJobDeliveryAt={nextJobDeliveryAt}
```

- [ ] **Step 5: Run the UI test and commit**

Run:

```bash
npx vitest run src/components/dashboard/__tests__/MatchesTab.test.ts
```

Expected: PASS with the new delivery-status assertions.

Commit:

```bash
git add src/hooks/useDashboardJobs.ts src/components/dashboard/MatchesTab.tsx src/pages/Dashboard.tsx src/components/dashboard/__tests__/MatchesTab.test.ts
git commit -m "feat: show daily delivery metadata in dashboard"
```

---

### Task 7: Final Verification And Cleanup

**Files:**
- Verify: `src/services/jobDeliveryProfile.ts`
- Verify: `src/services/cronEngine.ts`
- Verify: `api/cron/daily-alerts.ts`
- Verify: `api/cron/process-user.ts`
- Verify: `src/pages/Settings.tsx`
- Verify: `src/hooks/useDashboardJobs.ts`
- Verify: `src/components/dashboard/MatchesTab.tsx`

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npx vitest run \
  src/services/__tests__/jobDeliveryProfile.test.ts \
  src/services/__tests__/cronEngine.test.ts \
  src/services/__tests__/validator.test.ts \
  src/components/dashboard/__tests__/MatchesTab.test.ts
```

Expected: PASS for all targeted scheduling, readiness, preference, and dashboard tests.

- [ ] **Step 2: Run full type-checking**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no new diagnostics.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS and emit the Vite production bundle.

- [ ] **Step 4: Inspect the changed files before handoff**

Run:

```bash
git status --short
git diff -- src/contexts/AuthContext.tsx src/pages/Settings.tsx src/services/jobDeliveryProfile.ts src/services/cronEngine.ts src/services/jobMatchingEngine.ts api/cron/daily-alerts.ts api/cron/process-user.ts src/hooks/useDashboardJobs.ts src/components/dashboard/MatchesTab.tsx src/types/dailyJob.ts
```

Expected: only the planned files are changed, and the diff reflects delivery scheduling, readiness, matching, and dashboard messaging.

- [ ] **Step 5: Create the final integration commit**

```bash
git add src/contexts/AuthContext.tsx src/pages/Settings.tsx src/services/jobDeliveryProfile.ts src/services/__tests__/jobDeliveryProfile.test.ts src/services/cronEngine.ts src/services/__tests__/cronEngine.test.ts src/services/jobMatchingEngine.ts src/services/validator.ts src/services/__tests__/validator.test.ts src/types/dailyJob.ts api/cron/daily-alerts.ts api/cron/process-user.ts src/hooks/useDashboardJobs.ts src/components/dashboard/MatchesTab.tsx src/components/dashboard/__tests__/MatchesTab.test.ts
git commit -m "feat: personalize daily job delivery workflow"
```

---

## Self-Review

**Spec coverage**
- Local-time scheduling: covered by Tasks 1, 2, and 3.
- Readiness checks and skip reasons: covered by Tasks 1 and 4.
- Matching with resume, career paths, and settings: covered by Tasks 2 and 5.
- Richer stored metadata and email/dashboard consistency: covered by Task 4.
- Settings and dashboard UX updates: covered by Tasks 2 and 6.
- Focused testing and end-to-end verification: covered by Tasks 1, 3, 4, 5, 6, and 7.

**Placeholder scan**
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes exact file paths, concrete code snippets, explicit commands, and expected outcomes.

**Type consistency**
- Profile fields consistently use `deliveryTimezone`, `preferredDeliveryHour`, `nextJobDeliveryAt`, `lastSuccessfulJobRunLocalDate`, `matchReadiness`, and `matchingPreferences`.
- Daily batch metadata consistently uses `requestedLimit`, `returnedCount`, `qualityFilteredCount`, `dedupedCount`, `deliveryTimezone`, `deliveryLocalDate`, `emailSent`, `qualityLimited`, and `warnings`.
