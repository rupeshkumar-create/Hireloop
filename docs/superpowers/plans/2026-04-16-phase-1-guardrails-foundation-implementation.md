# Phase 1 Guardrails Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a strict guardrail foundation that validates jobs before AI, wraps AI tasks in a central execution engine, records latency and audit logs, and performs one safe self-healing retry on repairable outputs.

**Architecture:** Add `src/services/validator.ts` for hard business-rule checks and `src/services/systemEngine.ts` for guarded execution, validation, repair, latency measurement, and Firestore logging. Integrate the new layer into `generateDailyJobs()`, `generateColdEmail()`, and `tailorResume()` without changing the UI-facing API in `useDashboardJobs.ts`.

**Tech Stack:** TypeScript, Firebase Firestore, Vite, Vitest

---

## File Structure

- Create: `src/services/validator.ts`
- Create: `src/services/systemEngine.ts`
- Create: `src/services/__tests__/validator.test.ts`
- Create: `src/services/__tests__/systemEngine.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `src/services/aiService.ts`

Each file has one purpose:

- `validator.ts`: hard business-rule validation and structured validation results
- `systemEngine.ts`: single entry point for guarded execution, latency, audit logs, repair, and error wrapping
- `validator.test.ts`: pure unit coverage for pre-AI rules
- `systemEngine.test.ts`: unit coverage for wrapper behavior and self-healing
- `vitest.config.ts`: test runner config
- `aiService.ts`: integrate guardrails into existing AI flows

### Task 1: Add Test Harness

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing config and script changes**

Add this test config:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
});
```

Update `package.json` scripts and dev dependencies:

```json
{
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "deploy:rules": "firebase deploy --only firestore:rules"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/file-saver": "^2.0.7",
    "@types/node": "^22.14.0",
    "@vercel/node": "^5.7.5",
    "autoprefixer": "^10.4.21",
    "firebase-tools": "^14.20.0",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: install succeeds and `package-lock.json` updates to include `vitest`.

- [ ] **Step 3: Run the test command to verify the harness is wired**

Run:

```bash
npm test
```

Expected: exits successfully with `No test files found` or equivalent, proving the harness is active.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest harness for service guardrails"
```

### Task 2: Build Pre-AI Job Validators

**Files:**
- Create: `src/services/validator.ts`
- Create: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/validator.test.ts`

- [ ] **Step 1: Write the failing validator tests**

Create `src/services/__tests__/validator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  isRecent,
  validateJob,
  validateJobsBeforeAI,
  type GuardrailUserContext,
  type GuardrailJobInput,
} from '../validator';

const remoteUser: GuardrailUserContext = {
  preferences: {
    remoteOnly: true,
  },
};

const baseJob: GuardrailJobInput = {
  title: 'Senior Frontend Engineer',
  company: 'Acme',
  location: 'Remote - US',
  description: 'Build product features',
  url: 'https://jobs.example.com/123',
  isRemote: true,
  postedAt: new Date().toISOString(),
};

describe('isRecent', () => {
  it('returns true for a job posted today', () => {
    expect(isRecent(new Date().toISOString(), 7)).toBe(true);
  });

  it('returns false for a job older than 7 days', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecent(old, 7)).toBe(false);
  });
});

describe('validateJob', () => {
  it('rejects a job with no url', () => {
    const result = validateJob({ ...baseJob, url: '' }, remoteUser);
    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_URL');
  });

  it('rejects a non-remote job for a remote-only user', () => {
    const result = validateJob(
      { ...baseJob, isRemote: false, location: 'New York, NY' },
      remoteUser
    );
    expect(result.passed).toBe(false);
    expect(result.code).toBe('REMOTE_MISMATCH');
  });

  it('rejects a stale job', () => {
    const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const result = validateJob({ ...baseJob, postedAt: old }, remoteUser);
    expect(result.passed).toBe(false);
    expect(result.code).toBe('STALE_JOB');
  });

  it('accepts a valid recent remote job', () => {
    const result = validateJob(baseJob, remoteUser);
    expect(result.passed).toBe(true);
  });
});

describe('validateJobsBeforeAI', () => {
  it('splits accepted and rejected jobs', () => {
    const result = validateJobsBeforeAI(
      [
        baseJob,
        { ...baseJob, url: '', title: 'Broken Link Job' },
      ],
      remoteUser
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].validation.code).toBe('MISSING_URL');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/validator.test.ts
```

Expected: FAIL with module-not-found errors for `../validator`.

- [ ] **Step 3: Write the validator implementation**

Create `src/services/validator.ts`:

```ts
export interface ValidationResult {
  passed: boolean;
  reason?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface GuardrailUserContext {
  preferences?: {
    remoteOnly?: boolean;
  };
}

export interface GuardrailJobInput {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedAt: string;
  isRemote: boolean;
}

export interface JobValidationBatchResult<TJob> {
  accepted: TJob[];
  rejected: Array<{
    job: TJob;
    validation: ValidationResult;
  }>;
}

export function isRecent(postedAt: string, maxDaysOld: number = 7): boolean {
  const parsed = new Date(postedAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const ageMs = Date.now() - parsed.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return ageDays <= maxDaysOld;
}

export function validateJob(
  job: GuardrailJobInput,
  user: GuardrailUserContext,
  maxDaysOld: number = 7
): ValidationResult {
  if (!job.url || !job.url.startsWith('http')) {
    return {
      passed: false,
      code: 'MISSING_URL',
      reason: 'Job must include a valid URL before AI processing.',
    };
  }

  if (user.preferences?.remoteOnly && !job.isRemote) {
    return {
      passed: false,
      code: 'REMOTE_MISMATCH',
      reason: 'Job does not match the user remote-only preference.',
    };
  }

  if (!isRecent(job.postedAt, maxDaysOld)) {
    return {
      passed: false,
      code: 'STALE_JOB',
      reason: `Job is older than ${maxDaysOld} days.`,
    };
  }

  return { passed: true };
}

export function validateJobsBeforeAI<TJob extends GuardrailJobInput>(
  jobs: TJob[],
  user: GuardrailUserContext,
  maxDaysOld: number = 7
): JobValidationBatchResult<TJob> {
  const accepted: TJob[] = [];
  const rejected: Array<{ job: TJob; validation: ValidationResult }> = [];

  for (const job of jobs) {
    const validation = validateJob(job, user, maxDaysOld);
    if (validation.passed) {
      accepted.push(job);
    } else {
      rejected.push({ job, validation });
    }
  }

  return { accepted, rejected };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npm test -- src/services/__tests__/validator.test.ts
```

Expected: PASS with all validator tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/validator.ts src/services/__tests__/validator.test.ts
git commit -m "feat: add pre-ai job validators"
```

### Task 3: Build the Core Guardrail Wrapper

**Files:**
- Create: `src/services/systemEngine.ts`
- Create: `src/services/__tests__/systemEngine.test.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`

- [ ] **Step 1: Write the failing wrapper tests**

Create `src/services/__tests__/systemEngine.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  GuardrailError,
  runWithGuardrails,
  registerGuardrailTask,
  resetGuardrailRegistryForTests,
} from '../systemEngine';

describe('runWithGuardrails', () => {
  it('returns output when validation passes', async () => {
    resetGuardrailRegistryForTests();
    const logAI = vi.fn().mockResolvedValue(undefined);

    registerGuardrailTask('email_generation', {
      validateOutput: () => ({ passed: true }),
      logAI,
    });

    const result = await runWithGuardrails(
      'email_generation',
      async (input: { message: string }) => input.message,
      { message: 'hello' }
    );

    expect(result).toBe('hello');
    expect(logAI).toHaveBeenCalledTimes(1);
  });

  it('runs self-fix once when validation fails first', async () => {
    resetGuardrailRegistryForTests();
    const logAI = vi.fn().mockResolvedValue(undefined);
    const validateOutput = vi
      .fn()
      .mockReturnValueOnce({ passed: false, reason: 'too generic' })
      .mockReturnValueOnce({ passed: true });
    const selfFix = vi.fn().mockResolvedValue('fixed email');

    registerGuardrailTask('email_generation', {
      validateOutput,
      selfFix,
      logAI,
    });

    const result = await runWithGuardrails(
      'email_generation',
      async () => 'draft email',
      { company: 'Acme' }
    );

    expect(result).toBe('fixed email');
    expect(selfFix).toHaveBeenCalledTimes(1);
    expect(logAI).toHaveBeenCalledTimes(1);
  });

  it('throws GuardrailError when output still fails after repair', async () => {
    resetGuardrailRegistryForTests();

    registerGuardrailTask('email_generation', {
      validateOutput: vi
        .fn()
        .mockReturnValueOnce({ passed: false, reason: 'missing company' })
        .mockReturnValueOnce({ passed: false, reason: 'still missing company' }),
      selfFix: vi.fn().mockResolvedValue('broken email'),
      logAI: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      runWithGuardrails('email_generation', async () => 'draft', { company: 'Acme' })
    ).rejects.toBeInstanceOf(GuardrailError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- src/services/__tests__/systemEngine.test.ts
```

Expected: FAIL with module-not-found errors for `../systemEngine`.

- [ ] **Step 3: Write the wrapper implementation**

Create `src/services/systemEngine.ts`:

```ts
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { ValidationResult } from './validator';

export type GuardedTaskName =
  | 'job_scoring'
  | 'email_generation'
  | 'resume_tailoring'
  | 'validation';

export interface AILogRecord {
  taskName: GuardedTaskName;
  input: unknown;
  output: unknown;
  validation: ValidationResult;
  latency: number;
  createdAt: string;
  status: 'passed' | 'self_fixed' | 'failed';
  errorMessage?: string;
  userId?: string;
}

export class GuardrailError extends Error {
  taskName: GuardedTaskName;
  validation?: ValidationResult;
  latency?: number;

  constructor(message: string, taskName: GuardedTaskName, validation?: ValidationResult, latency?: number) {
    super(message);
    this.name = 'GuardrailError';
    this.taskName = taskName;
    this.validation = validation;
    this.latency = latency;
  }
}

interface GuardrailTaskConfig<TInput, TOutput> {
  validateOutput: (output: TOutput, input: TInput) => Promise<ValidationResult> | ValidationResult;
  selfFix?: (
    output: TOutput,
    input: TInput,
    validation: ValidationResult
  ) => Promise<TOutput>;
  logAI?: (record: AILogRecord) => Promise<void>;
}

const taskRegistry = new Map<GuardedTaskName, GuardrailTaskConfig<any, any>>();

async function writeAILog(record: AILogRecord): Promise<void> {
  await addDoc(collection(db, 'aiLogs'), record);
}

export function registerGuardrailTask<TInput, TOutput>(
  taskName: GuardedTaskName,
  config: GuardrailTaskConfig<TInput, TOutput>
) {
  taskRegistry.set(taskName, config);
}

export function resetGuardrailRegistryForTests() {
  taskRegistry.clear();
}

export async function runWithGuardrails<TInput, TOutput>(
  taskName: GuardedTaskName,
  fn: (input: TInput) => Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  const config = taskRegistry.get(taskName);
  if (!config) {
    throw new Error(`No guardrail config registered for task "${taskName}".`);
  }

  const start = Date.now();
  let output: TOutput | undefined;
  let validation: ValidationResult = { passed: false, reason: 'Validation did not run.' };
  let status: AILogRecord['status'] = 'failed';
  let errorMessage: string | undefined;

  try {
    output = await fn(input);
    validation = await config.validateOutput(output, input);

    if (!validation.passed) {
      if (!config.selfFix) {
        throw new GuardrailError(validation.reason || 'Validation failed.', taskName, validation, Date.now() - start);
      }

      output = await config.selfFix(output, input, validation);
      validation = await config.validateOutput(output, input);

      if (!validation.passed) {
        throw new GuardrailError(validation.reason || 'Validation failed after self-fix.', taskName, validation, Date.now() - start);
      }

      status = 'self_fixed';
    } else {
      status = 'passed';
    }

    return output;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof GuardrailError) {
      throw error;
    }
    throw new GuardrailError(errorMessage, taskName, validation, Date.now() - start);
  } finally {
    const latency = Date.now() - start;
    const logRecord: AILogRecord = {
      taskName,
      input,
      output,
      validation,
      latency,
      createdAt: new Date().toISOString(),
      status,
      errorMessage,
      userId: auth.currentUser?.uid,
    };

    try {
      const logFn = config.logAI ?? writeAILog;
      await logFn(logRecord);
    } catch (logError) {
      console.error('Failed to write aiLogs record:', logError);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npm test -- src/services/__tests__/systemEngine.test.ts
```

Expected: PASS with all wrapper tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/systemEngine.ts src/services/__tests__/systemEngine.test.ts
git commit -m "feat: add guarded execution engine"
```

### Task 4: Integrate Pre-AI Validation Into Job Generation

**Files:**
- Modify: `src/services/aiService.ts`
- Test: `src/services/__tests__/validator.test.ts`

- [ ] **Step 1: Add the validator imports and job-to-guardrail mapping**

Update `src/services/aiService.ts` imports:

```ts
import {
  validateJobsBeforeAI,
  type GuardrailJobInput,
  type GuardrailUserContext,
} from './validator';
```

Add a mapper near the job helpers:

```ts
function toGuardrailJob(job: SerperJob): GuardrailJobInput {
  const locationText = job.location.toLowerCase();
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    url: job.applyLink,
    postedAt: toIsoDate(job.postedAt, job.daysOld),
    isRemote: locationText.includes('remote'),
  };
}
```

- [ ] **Step 2: Run lint to capture the pre-change baseline**

Run:

```bash
npm run lint
```

Expected: typecheck runs; existing unrelated errors, if any, are noted before the integration edit.

- [ ] **Step 3: Add pre-AI validation immediately before scoring**

Replace the existing validated-job handoff:

```ts
const filteredJobs = mergeDedupJobs([], realJobs);
console.log('After Validation:', filteredJobs.length);
```

with:

```ts
const dedupedJobs = mergeDedupJobs([], realJobs);
const jobValidation = validateJobsBeforeAI(
  dedupedJobs.map(toGuardrailJob),
  {
    preferences: {
      remoteOnly: jobType === 'remote',
    },
  } satisfies GuardrailUserContext,
  7
);

const acceptedFingerprints = new Set(
  jobValidation.accepted.map((job) => `${job.title.toLowerCase().trim()}::${job.company.toLowerCase().trim()}`)
);

const filteredJobs = dedupedJobs.filter((job) =>
  acceptedFingerprints.has(jobFingerprint(job.title, job.company))
);

console.log('After Validation:', filteredJobs.length);
console.log('Rejected Before AI:', jobValidation.rejected.length);
```

- [ ] **Step 4: Run targeted tests and typecheck**

Run:

```bash
npm test -- src/services/__tests__/validator.test.ts
npm run lint
```

Expected: PASS for validator tests and no new type errors from the `aiService.ts` integration.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiService.ts
git commit -m "feat: enforce pre-ai job validation"
```

### Task 5: Wrap Email and Resume Tasks With Guardrails

**Files:**
- Modify: `src/services/aiService.ts`
- Modify: `src/services/validator.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`

- [ ] **Step 1: Add output validators for email and resume**

Append these helpers to `src/services/validator.ts`:

```ts
export function validateGeneratedEmail(
  output: string,
  input: { company: string; jobTitle: string }
): ValidationResult {
  const wordCount = output.trim().split(/\s+/).filter(Boolean).length;

  if (!output.includes(input.company)) {
    return {
      passed: false,
      code: 'MISSING_COMPANY',
      reason: 'Generated email must include the company name.',
    };
  }

  if (!output.toLowerCase().includes(input.jobTitle.toLowerCase())) {
    return {
      passed: false,
      code: 'MISSING_ROLE',
      reason: 'Generated email must reference the role.',
    };
  }

  if (wordCount > 120) {
    return {
      passed: false,
      code: 'EMAIL_TOO_LONG',
      reason: 'Generated email exceeds 120 words.',
    };
  }

  if (/i am excited|motivated individual/i.test(output)) {
    return {
      passed: false,
      code: 'GENERIC_LANGUAGE',
      reason: 'Generated email contains generic language.',
    };
  }

  return { passed: true };
}

export function validateTailoredResumeOutput(
  output: string,
  input: { jobDescription: string }
): ValidationResult {
  if (!output.trim()) {
    return {
      passed: false,
      code: 'EMPTY_RESUME',
      reason: 'Tailored resume must not be empty.',
    };
  }

  const jobKeywords = input.jobDescription
    .toLowerCase()
    .match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [];

  const keywordMatches = jobKeywords.filter((keyword) => output.toLowerCase().includes(keyword));

  if (keywordMatches.length === 0) {
    return {
      passed: false,
      code: 'NO_KEYWORD_ALIGNMENT',
      reason: 'Tailored resume must align with job keywords.',
    };
  }

  return { passed: true };
}
```

- [ ] **Step 2: Register the guarded tasks in `aiService.ts`**

Add imports:

```ts
import { registerGuardrailTask, runWithGuardrails } from './systemEngine';
import {
  validateGeneratedEmail,
  validateTailoredResumeOutput,
} from './validator';
```

Register tasks once near the top-level module scope:

```ts
registerGuardrailTask('email_generation', {
  validateOutput: validateGeneratedEmail,
  selfFix: async (output, input, validation) =>
    improveText(
      output,
      `Fix this email. Reason: ${validation.reason}. Keep it under 120 words. Include ${input.company}. Include ${input.jobTitle}. Remove generic language.`
    ),
});

registerGuardrailTask('resume_tailoring', {
  validateOutput: validateTailoredResumeOutput,
  selfFix: async (output, input, validation) =>
    improveText(
      output,
      `Fix this tailored resume. Reason: ${validation.reason}. Keep all claims grounded in the original resume and align more clearly with the job description keywords.`
    ),
});
```

- [ ] **Step 3: Route the public functions through `runWithGuardrails()`**

Refactor `generateColdEmail()` to:

```ts
export async function generateColdEmail(
  jobTitle: string,
  company: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = ''
) {
  return runWithGuardrails(
    'email_generation',
    async () => {
      const prompt = `...existing prompt...`;
      const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6');
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty cold email generated');
      }
      return content.trim();
    },
    { jobTitle, company, resumeText, antiSlopEnabled, writingStyleContext }
  );
}
```

Refactor `tailorResume()` to:

```ts
export async function tailorResume(
  jobTitle: string,
  jobDescription: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = ''
) {
  return runWithGuardrails(
    'resume_tailoring',
    async () => {
      const prompt = `...existing prompt...`;
      const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6');
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty tailored resume generated');
      }
      return content.trim();
    },
    { jobTitle, jobDescription, resumeText, antiSlopEnabled, writingStyleContext }
  );
}
```

- [ ] **Step 4: Run wrapper tests and typecheck**

Run:

```bash
npm test -- src/services/__tests__/systemEngine.test.ts
npm run lint
```

Expected: PASS for wrapper tests and no new type errors in `aiService.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiService.ts src/services/validator.ts
git commit -m "feat: guard email and resume generation"
```

### Task 6: Full Verification

**Files:**
- Test: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`
- Modify: `src/services/aiService.ts` if final fixes are needed

- [ ] **Step 1: Run the focused service test suite**

Run:

```bash
npm test
```

Expected: PASS with the new `validator` and `systemEngine` tests green.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: PASS with no new type errors introduced by the guardrail integration.

- [ ] **Step 3: Smoke-check the key flows manually**

Verify these flows in the app:

```text
1. Generate jobs from the dashboard and confirm invalid jobs are filtered before ranking.
2. Save a Pro job and confirm cold email and resume generation still complete.
3. Inspect Firestore aiLogs and confirm records include taskName, validation, latency, status, and createdAt.
```

Expected:

```text
- jobs with missing url or stale dates do not reach scoring
- email and resume generations still return output
- aiLogs records appear for guarded tasks
```

- [ ] **Step 4: Final commit**

```bash
git add src/services/aiService.ts src/services/systemEngine.ts src/services/validator.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add phase 1 guardrails foundation"
```

## Self-Review

### Spec Coverage

- central wrapper in `systemEngine.ts`: covered in Task 3
- hard pre-AI validation in `validator.ts`: covered in Task 2
- pre-AI enforcement in job generation: covered in Task 4
- self-healing for repairable outputs: covered in Task 5
- Firestore audit logging and latency: covered in Task 3 and verified in Task 6

### Placeholder Scan

- no `TBD`
- no `TODO`
- no unresolved file names
- no vague “add validation” steps without code or commands

### Type Consistency

- `ValidationResult`, `GuardrailJobInput`, and `GuardedTaskName` are defined once and reused across the plan
- `runWithGuardrails()` is the only wrapper entry point
- `validateJobsBeforeAI()` is the pre-AI batch validator referenced consistently in integration steps
