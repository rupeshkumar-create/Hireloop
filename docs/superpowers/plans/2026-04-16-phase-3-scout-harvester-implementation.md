# Phase 3 Scout Harvester Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formalize Scout, Harvester, and De-Duper into explicit engine stages by guarding query generation, harvesting about 40 raw Serper jobs from 10 queries, and deduplicating candidates by `title + company` before later validation and scoring.

**Architecture:** Add deterministic Scout validation to `validator.ts`, register a new `query_generation` guardrail task in `systemEngine.ts` and `aiService.ts`, introduce explicit Scout/Harvester helper functions inside `aiService.ts`, and keep `serperService.ts` as the deterministic Harvester core with `jobFingerprint()` as the canonical dedupe key. Refactor `generateDailyJobs()` to call the explicit stages while preserving its current public behavior.

**Tech Stack:** TypeScript, Firebase Firestore, Vite, Vitest, Serper API

---

## File Structure

- Modify: `src/services/systemEngine.ts`
- Modify: `src/services/validator.ts`
- Modify: `src/services/aiService.ts`
- Modify: `src/services/serperService.ts`
- Modify: `src/services/__tests__/validator.test.ts`
- Create: `src/services/__tests__/phase3ScoutHarvester.test.ts`

Each file has one clear role:

- `systemEngine.ts`: allow `query_generation` as a guarded task
- `validator.ts`: own Scout output validation
- `aiService.ts`: own Scout orchestration and Stage 3 flow inside `generateDailyJobs()`
- `serperService.ts`: stay the Harvester core and expose deterministic merge/dedupe helpers if needed
- `validator.test.ts`: extend deterministic validator coverage
- `phase3ScoutHarvester.test.ts`: cover stage boundaries and dedupe semantics

### Task 1: Add Scout Output Validation

**Files:**
- Modify: `src/services/validator.ts`
- Modify: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/validator.test.ts`

- [ ] **Step 1: Write the failing Scout validator tests**

Append these tests to `src/services/__tests__/validator.test.ts`:

```ts
import { validateQueryGenerationOutput } from '../validator';

describe('validateQueryGenerationOutput', () => {
  it('rejects non-array output', () => {
    const result = validateQueryGenerationOutput({}, { expectedCount: 10 });
    expect(result.passed).toBe(false);
    expect(result.code).toBe('INVALID_QUERY_OUTPUT');
  });

  it('rejects arrays with fewer than 10 queries', () => {
    const result = validateQueryGenerationOutput(
      ['frontend engineer remote react'],
      { expectedCount: 10 }
    );
    expect(result.passed).toBe(false);
    expect(result.code).toBe('QUERY_COUNT_MISMATCH');
  });

  it('rejects duplicate queries after normalization', () => {
    const result = validateQueryGenerationOutput(
      [
        'frontend engineer remote react',
        'frontend engineer remote react',
        'q3',
        'q4',
        'q5',
        'q6',
        'q7',
        'q8',
        'q9',
        'q10',
      ],
      { expectedCount: 10 }
    );
    expect(result.passed).toBe(false);
    expect(result.code).toBe('DUPLICATE_QUERY');
  });

  it('accepts 10 unique non-empty queries', () => {
    const result = validateQueryGenerationOutput(
      [
        'frontend developer remote react',
        'react engineer remote startup',
        'typescript frontend remote saas',
        'senior react remote product engineer',
        'frontend software engineer remote startup',
        'remote react typescript engineer',
        'frontend engineer remote growth team',
        'remote ui engineer react typescript',
        'frontend product engineer remote react',
        'remote javascript react frontend developer',
      ],
      { expectedCount: 10 }
    );
    expect(result.passed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/validator.test.ts
```

Expected: FAIL because `validateQueryGenerationOutput` does not exist yet.

- [ ] **Step 3: Implement the validator in `validator.ts`**

Add this export near the other output validators:

```ts
export function validateQueryGenerationOutput(
  output: unknown,
  input: { expectedCount: number }
): ValidationResult {
  if (!Array.isArray(output)) {
    return {
      passed: false,
      code: 'INVALID_QUERY_OUTPUT',
      reason: 'Query generation output must be an array.',
    };
  }

  if (output.length !== input.expectedCount) {
    return {
      passed: false,
      code: 'QUERY_COUNT_MISMATCH',
      reason: `Query generation must return exactly ${input.expectedCount} queries.`,
      details: { expectedCount: input.expectedCount, actualCount: output.length },
    };
  }

  const seen = new Set<string>();
  for (const query of output) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      return {
        passed: false,
        code: 'INVALID_QUERY_ITEM',
        reason: 'Every generated query must be a non-empty string.',
      };
    }

    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    if (seen.has(normalized)) {
      return {
        passed: false,
        code: 'DUPLICATE_QUERY',
        reason: 'Generated queries must be unique after normalization.',
      };
    }
    seen.add(normalized);
  }

  return { passed: true };
}
```

- [ ] **Step 4: Run the validator tests**

Run:

```bash
npm test -- src/services/__tests__/validator.test.ts
```

Expected: PASS with the Scout validator tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/validator.ts src/services/__tests__/validator.test.ts
git commit -m "feat: add scout query validation"
```

### Task 2: Enable Guarded `query_generation`

**Files:**
- Modify: `src/services/systemEngine.ts`
- Modify: `src/services/__tests__/systemEngine.test.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`

- [ ] **Step 1: Extend the guarded task type**

Update `GuardedTaskName` in `src/services/systemEngine.ts`:

```ts
export type GuardedTaskName =
  | 'query_generation'
  | 'job_scoring'
  | 'email_generation'
  | 'resume_tailoring'
  | 'validation';
```

- [ ] **Step 2: Add a focused registry test**

Append this test to `src/services/__tests__/systemEngine.test.ts`:

```ts
  it('supports guarded query generation', async () => {
    resetGuardrailRegistryForTests();
    const logAI = vi.fn().mockResolvedValue(undefined);

    registerGuardrailTask('query_generation', {
      validateOutput: () => ({ passed: true }),
      logAI,
    });

    const result = await runWithGuardrails(
      'query_generation',
      async () => ['frontend developer remote react'],
      { profile: 'x' }
    );

    expect(result).toEqual(['frontend developer remote react']);
    expect(logAI).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 3: Run the wrapper tests**

Run:

```bash
npm test -- src/services/__tests__/systemEngine.test.ts
```

Expected: PASS after adding `query_generation` to the task union.

- [ ] **Step 4: Commit**

```bash
git add src/services/systemEngine.ts src/services/__tests__/systemEngine.test.ts
git commit -m "feat: enable guarded query generation"
```

### Task 3: Build the Explicit Scout Stage

**Files:**
- Modify: `src/services/aiService.ts`
- Create: `src/services/__tests__/phase3ScoutHarvester.test.ts`
- Test: `src/services/__tests__/phase3ScoutHarvester.test.ts`

- [ ] **Step 1: Write the failing stage tests**

Create `src/services/__tests__/phase3ScoutHarvester.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dedupeJobsByFingerprint, normalizeGeneratedQueries } from '../aiService';

describe('normalizeGeneratedQueries', () => {
  it('trims whitespace and limits output to 10 queries', () => {
    const result = normalizeGeneratedQueries([
      '  frontend developer remote react  ',
      'react engineer remote startup',
      'typescript frontend remote saas',
      'senior react remote product engineer',
      'frontend software engineer remote startup',
      'remote react typescript engineer',
      'frontend engineer remote growth team',
      'remote ui engineer react typescript',
      'frontend product engineer remote react',
      'remote javascript react frontend developer',
      'extra query that should be cut',
    ]);

    expect(result).toHaveLength(10);
    expect(result[0]).toBe('frontend developer remote react');
  });
});

describe('dedupeJobsByFingerprint', () => {
  it('dedupes jobs with the same title and company', () => {
    const result = dedupeJobsByFingerprint([
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'One',
        applyLink: 'https://a',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'Two',
        applyLink: 'https://b',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it('keeps jobs with the same title at different companies', () => {
    const result = dedupeJobsByFingerprint([
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'One',
        applyLink: 'https://a',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
      {
        title: 'Frontend Engineer',
        company: 'Globex',
        location: 'Remote',
        description: 'Two',
        applyLink: 'https://b',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
    ]);

    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/phase3ScoutHarvester.test.ts
```

Expected: FAIL because the exports do not exist yet.

- [ ] **Step 3: Add Scout helper types and exports**

In `src/services/aiService.ts`, add:

```ts
interface ScoutContext {
  careerPaths: string[];
  resumeText: string;
  resumeSummary?: string;
  structuredProfile?: {
    skills: string[];
    techStack: string[];
    seniority: string;
    roles: string[];
    industries: string[];
  };
  preferences?: {
    remoteOnly: boolean;
    salaryFloor: number | null;
    locations: string[];
  };
}

export function normalizeGeneratedQueries(queries: string[]): string[] {
  return Array.from(
    new Set(
      queries
        .map((query) => query.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
    )
  ).slice(0, 10);
}

export function dedupeJobsByFingerprint(jobs: SerperJob[]): SerperJob[] {
  const seen = new Set<string>();
  const deduped: SerperJob[] = [];

  for (const job of jobs) {
    const fingerprint = jobFingerprint(job.title, job.company);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    deduped.push(job);
  }

  return deduped;
}
```

- [ ] **Step 4: Add the explicit Scout builder and registration**

Add imports:

```ts
import { validateQueryGenerationOutput } from './validator';
```

Register the task near the other registrations:

```ts
registerGuardrailTask<ScoutContext, string[]>('query_generation', {
  validateOutput: (output) =>
    validateQueryGenerationOutput(output, { expectedCount: 10 }),
});
```

Add the Scout function:

```ts
async function buildQueries(user: ScoutContext): Promise<string[]> {
  const deterministic = [
    ...buildDeterministicQueries(user.careerPaths, 'remote'),
    ...buildExpansionQueries(user.careerPaths, 'remote'),
    ...buildBoardQueries(user.careerPaths, 'remote'),
  ];

  const normalized = normalizeGeneratedQueries(deterministic);
  return normalized.slice(0, 10);
}
```

- [ ] **Step 5: Run the stage tests**

Run:

```bash
npm test -- src/services/__tests__/phase3ScoutHarvester.test.ts
```

Expected: PASS with normalization and dedupe tests green.

- [ ] **Step 6: Commit**

```bash
git add src/services/aiService.ts src/services/__tests__/phase3ScoutHarvester.test.ts
git commit -m "feat: add explicit scout stage helpers"
```

### Task 4: Formalize Harvester and De-Duper in `generateDailyJobs()`

**Files:**
- Modify: `src/services/aiService.ts`
- Modify: `src/services/serperService.ts`
- Test: `src/services/__tests__/phase3ScoutHarvester.test.ts`

- [ ] **Step 1: Add an explicit Harvester helper in `aiService.ts`**

Add this helper above `generateDailyJobs()`:

```ts
async function harvestJobs(
  queries: string[],
  options: {
    jobType: string;
    userLocation: string;
    minSalary: number | null;
  }
) {
  return searchRemoteJobs(queries, {
    jobType: options.jobType,
    userLocation: options.userLocation,
    maxQueries: 10,
    maxDaysOld: 7,
  });
}
```

- [ ] **Step 2: Make Harvester target about 40 raw jobs**

In `src/services/serperService.ts`, change:

```ts
  const queriesToSearch = queries.slice(0, options.maxQueries ?? 3);
```

to:

```ts
  const queriesToSearch = queries.slice(0, options.maxQueries ?? 10);
```

Add a soft cap after `allJobs.push(candidateJob);`:

```ts
        if (allJobs.length >= (options.maxJobs ?? 40)) {
          break;
        }
```

Then after the inner loop, add:

```ts
      if (allJobs.length >= (options.maxJobs ?? 40)) {
        break;
      }
```

Add `maxJobs?: number;` to `SearchRemoteJobsOptions`.

- [ ] **Step 3: Refactor `generateDailyJobs()` to call explicit stages**

Replace the query-generation section with:

```ts
  const scoutContext: ScoutContext = {
    careerPaths,
    resumeText,
    resumeSummary: userProfile?.resumeSummary,
    structuredProfile: userProfile?.structuredProfile,
    preferences: userProfile?.preferences,
  };

  const queries = await runWithGuardrails(
    'query_generation',
    buildQueries,
    scoutContext
  );
```

Replace the direct Serper call with:

```ts
  const { jobs: harvestedJobs, stats: harvestedStats } = await harvestJobs(queries, {
    jobType,
    userLocation: location,
    minSalary,
  });
```

Replace the dedupe handoff with:

```ts
  const dedupedJobs = dedupeJobsByFingerprint(
    mergeDedupJobs([], harvestedJobs)
  );
```

Then continue the existing validation and scoring flow from `dedupedJobs`.

- [ ] **Step 4: Run targeted tests and lint**

Run:

```bash
npm test -- src/services/__tests__/phase3ScoutHarvester.test.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts
npm run lint
```

Expected: PASS for tests and no new type errors in `aiService.ts` or `serperService.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiService.ts src/services/serperService.ts
git commit -m "feat: formalize scout harvester and deduper stages"
```

### Task 5: Final Verification

**Files:**
- Test: `src/services/__tests__/phase3ScoutHarvester.test.ts`
- Test: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`
- Modify: `src/services/aiService.ts` if fixes are needed
- Modify: `src/services/serperService.ts` if fixes are needed

- [ ] **Step 1: Run the focused engine suite**

Run:

```bash
npm test -- src/services/__tests__/phase3ScoutHarvester.test.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: PASS with Scout, Harvester, validator, and existing onboarding/guardrail tests green.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: PASS with no new type errors introduced by Phase 3.

- [ ] **Step 3: Run a production build**

Run:

```bash
npm run build
```

Expected: PASS with the existing warning profile only.

- [ ] **Step 4: Manual smoke-check**

Verify these flows in the app:

```text
1. Trigger daily job generation and inspect logs for 10 Scout queries.
2. Confirm Serper harvesting stops around 40 raw jobs total.
3. Confirm duplicate title+company jobs collapse to one job before later stages.
4. Confirm the downstream validation and scoring flow still receives jobs.
```

Expected:

```text
- Scout always yields 10 validated queries
- Harvester pulls a bounded raw candidate pool
- De-Duper removes title+company collisions
- existing job generation still works end-to-end
```

- [ ] **Step 5: Final commit**

```bash
git add src/services/systemEngine.ts src/services/validator.ts src/services/aiService.ts src/services/serperService.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts src/services/__tests__/phase3ScoutHarvester.test.ts
git commit -m "feat: add phase 3 scout and harvester stages"
```

## Self-Review

### Spec Coverage

- Scout as explicit guarded query generation: covered in Tasks 1, 2, and 3
- Harvester using Serper to fetch about 40 jobs: covered in Task 4
- title+company De-Duper: covered in Task 3 and Task 4
- integration into existing daily generation flow: covered in Task 4

### Placeholder Scan

- no `TBD`
- no `TODO`
- no unresolved file names
- no vague “add validation” or “handle edge cases” steps without code or commands

### Type Consistency

- `query_generation` is named consistently across `systemEngine.ts`, validator logic, and `aiService.ts`
- `ScoutContext`, `normalizeGeneratedQueries()`, and `dedupeJobsByFingerprint()` are referenced consistently
- `jobFingerprint()` remains the canonical dedupe primitive throughout the plan
