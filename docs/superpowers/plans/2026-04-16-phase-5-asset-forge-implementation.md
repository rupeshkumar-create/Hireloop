# Phase 5 Asset Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Asset Forge stage that looks up recruiters through Apollo, generates validated cold-email assets only when recruiter data exists, and skips outreach cleanly when no recruiter is found.

**Architecture:** Add a dedicated `apolloService.ts` to normalize recruiter lookup, keep `email_generation` as the existing guardrail task, and add a structured Asset Forge wrapper in `aiService.ts` that orchestrates Apollo lookup plus guarded cold-email generation. Preserve the current `generateColdEmail()` API for existing callers while introducing a richer structured outreach path for the paid feature.

**Tech Stack:** TypeScript, Firebase Firestore, Vite, Vitest, OpenRouter-compatible models, Apollo API

---

## File Structure

- Create: `src/services/apolloService.ts`
- Create: `src/services/__tests__/assetForge.test.ts`
- Modify: `src/services/validator.ts`
- Modify: `src/services/aiService.ts`
- Modify: `src/services/__tests__/validator.test.ts`

Each file has one clear responsibility:

- `apolloService.ts`: recruiter lookup and Apollo response normalization
- `assetForge.test.ts`: focused flow tests for recruiter found vs skipped behavior
- `validator.ts`: deterministic email validation under the Asset Forge contract
- `aiService.ts`: Asset Forge orchestration plus compatibility with existing email callers
- `validator.test.ts`: deterministic validation coverage

### Task 1: Tighten Asset Forge Email Validation

**Files:**
- Modify: `src/services/validator.ts`
- Modify: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/validator.test.ts`

- [ ] **Step 1: Write the failing validator tests**

Append these tests to `src/services/__tests__/validator.test.ts`:

```ts
import { validateAssetForgeEmail } from '../validator';

describe('validateAssetForgeEmail', () => {
  it('rejects an email that does not mention the company', () => {
    const result = validateAssetForgeEmail(
      'I can help your team with React architecture for this Frontend Engineer role.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_COMPANY');
  });

  it('rejects an email that does not mention the role', () => {
    const result = validateAssetForgeEmail(
      'I can help Acme ship product faster with React and TypeScript.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_ROLE');
  });

  it('rejects an email over 120 words', () => {
    const longEmail = `${'Acme Frontend Engineer '.repeat(50)}`.trim();
    const result = validateAssetForgeEmail(longEmail, {
      company: 'Acme',
      jobTitle: 'Frontend Engineer',
    });

    expect(result.passed).toBe(false);
    expect(result.code).toBe('EMAIL_TOO_LONG');
  });

  it('accepts a concise company-and-role-specific email', () => {
    const result = validateAssetForgeEmail(
      'I saw the Frontend Engineer opening at Acme. My resume shows React, TypeScript, and dashboard work that maps well to the role, and I would be glad to connect.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
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

Expected: FAIL because `validateAssetForgeEmail` does not exist yet.

- [ ] **Step 3: Implement `validateAssetForgeEmail()`**

In `src/services/validator.ts`, add:

```ts
export function validateAssetForgeEmail(
  output: string,
  input: { company: string; jobTitle: string }
): ValidationResult {
  return validateGeneratedEmail(output, input);
}
```

This is intentionally thin in Phase 5 so the Asset Forge contract uses the existing strict checks without duplicating logic.

- [ ] **Step 4: Run the validator tests**

Run:

```bash
npm test -- src/services/__tests__/validator.test.ts
```

Expected: PASS with the Asset Forge email validation tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/validator.ts src/services/__tests__/validator.test.ts
git commit -m "feat: add asset forge email validation"
```

### Task 2: Add Apollo Recruiter Lookup Service

**Files:**
- Create: `src/services/apolloService.ts`
- Create: `src/services/__tests__/assetForge.test.ts`
- Test: `src/services/__tests__/assetForge.test.ts`

- [ ] **Step 1: Write the failing Apollo normalization tests**

Create `src/services/__tests__/assetForge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeApolloRecruiter,
  type ApolloRecruiterPayload,
} from '../apolloService';

describe('normalizeApolloRecruiter', () => {
  it('returns null when recruiter email is missing', () => {
    const result = normalizeApolloRecruiter({
      first_name: 'Jane',
      last_name: 'Doe',
      title: 'Recruiter',
      email: '',
      linkedin_url: '',
    });

    expect(result).toBeNull();
  });

  it('returns normalized recruiter data when email exists', () => {
    const result = normalizeApolloRecruiter({
      first_name: 'Jane',
      last_name: 'Doe',
      title: 'Recruiter',
      email: 'jane@acme.com',
      linkedin_url: 'https://linkedin.com/in/jane',
    });

    expect(result).toEqual({
      name: 'Jane Doe',
      title: 'Recruiter',
      email: 'jane@acme.com',
      linkedinUrl: 'https://linkedin.com/in/jane',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/assetForge.test.ts
```

Expected: FAIL because `apolloService.ts` does not exist.

- [ ] **Step 3: Implement the Apollo service**

Create `src/services/apolloService.ts`:

```ts
export interface RecruiterContact {
  name: string;
  title: string;
  email: string;
  linkedinUrl?: string;
}

export interface ApolloRecruiterPayload {
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
}

export function normalizeApolloRecruiter(
  payload: ApolloRecruiterPayload
): RecruiterContact | null {
  const email = payload.email?.trim();
  if (!email) {
    return null;
  }

  const fullName =
    payload.name?.trim() ||
    [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim();

  return {
    name: fullName || 'Unknown Recruiter',
    title: payload.title?.trim() || 'Recruiter',
    email,
    linkedinUrl: payload.linkedin_url?.trim() || undefined,
  };
}

export async function fetchRecruiterFromApollo(input: {
  company: string;
  jobTitle: string;
}): Promise<RecruiterContact | null> {
  const apiKey = import.meta.env.VITE_APOLLO_API_KEY;
  if (!apiKey) {
    console.warn('Apollo API key missing; skipping recruiter lookup.');
    return null;
  }

  try {
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_organization_name: input.company,
        person_titles: ['Recruiter', 'Talent Partner', 'Hiring Manager'],
        page: 1,
        per_page: 5,
      }),
    });

    if (!response.ok) {
      console.error('Apollo recruiter lookup failed with status:', response.status);
      return null;
    }

    const data = await response.json();
    const people = Array.isArray(data.people) ? data.people : [];

    for (const person of people) {
      const recruiter = normalizeApolloRecruiter(person);
      if (recruiter) {
        return recruiter;
      }
    }

    return null;
  } catch (error) {
    console.error('Apollo recruiter lookup error:', error);
    return null;
  }
}
```

- [ ] **Step 4: Run the Apollo tests**

Run:

```bash
npm test -- src/services/__tests__/assetForge.test.ts
```

Expected: PASS with the recruiter normalization tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/apolloService.ts src/services/__tests__/assetForge.test.ts
git commit -m "feat: add apollo recruiter lookup service"
```

### Task 3: Build the Asset Forge Email Flow

**Files:**
- Modify: `src/services/aiService.ts`
- Test: `src/services/__tests__/assetForge.test.ts`

- [ ] **Step 1: Add the failing flow tests**

Append these tests to `src/services/__tests__/assetForge.test.ts`:

```ts
import { buildAssetForgeSkipResult } from '../aiService';

describe('buildAssetForgeSkipResult', () => {
  it('returns a recruiter_not_found skip payload', () => {
    expect(buildAssetForgeSkipResult('recruiter_not_found')).toEqual({
      status: 'skipped',
      reason: 'recruiter_not_found',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/assetForge.test.ts
```

Expected: FAIL because `buildAssetForgeSkipResult` does not exist yet.

- [ ] **Step 3: Add Asset Forge types and helpers in `aiService.ts`**

Add imports:

```ts
import { fetchRecruiterFromApollo, type RecruiterContact } from './apolloService';
import { validateAssetForgeEmail } from './validator';
```

Add these interfaces near the email functions:

```ts
export interface OutreachJobContext {
  title: string;
  company: string;
  description?: string;
  location?: string;
  url?: string;
}

export interface AssetForgeEmailInput {
  job: OutreachJobContext;
  recruiter: RecruiterContact;
  resumeSummary: string;
  antiSlopEnabled?: boolean;
  writingStyleContext?: string;
}

export interface AssetForgeEmailResult {
  status: 'generated' | 'skipped';
  reason?: 'recruiter_not_found' | 'apollo_error';
  recruiter?: RecruiterContact;
  email?: string;
}

export function buildAssetForgeSkipResult(
  reason: 'recruiter_not_found' | 'apollo_error'
): AssetForgeEmailResult {
  return {
    status: 'skipped',
    reason,
  };
}
```

Update the `email_generation` registration to validate with:

```ts
  validateOutput: (output, input) =>
    validateAssetForgeEmail(output, {
      company: input.company,
      jobTitle: input.jobTitle,
    }),
```

- [ ] **Step 4: Add a structured internal email generator**

Add a new helper:

```ts
async function generateAssetForgeEmail(
  input: AssetForgeEmailInput
): Promise<string> {
  return runWithGuardrails(
    'email_generation',
    async () => {
      const prompt = `You are an expert career coach specializing in concise recruiter outreach.
Write a cold email to ${input.recruiter.name} at ${input.job.company} about the ${input.job.title} role.

Rules:
- Mention ${input.job.company}
- Mention ${input.job.title}
- Under 120 words
- Ground the message in this resume summary only
- Do not invent background or recruiter facts

${input.antiSlopEnabled !== false ? ANTI_SLOP_PROMPT : ''}

Resume Summary:
${input.resumeSummary}

Return ONLY the email body.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'anthropic/claude-opus-4.6'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty cold email generated');
      }
      return content.trim();
    },
    {
      company: input.job.company,
      jobTitle: input.job.title,
      resumeSummary: input.resumeSummary,
      recruiter: input.recruiter,
      antiSlopEnabled: input.antiSlopEnabled !== false,
      writingStyleContext: input.writingStyleContext || '',
    }
  );
}
```

- [ ] **Step 5: Add the public Asset Forge wrapper**

Add this export:

```ts
export async function generateAssetForgeEmailForJob(input: {
  job: OutreachJobContext;
  resumeSummary: string;
  antiSlopEnabled?: boolean;
  writingStyleContext?: string;
}): Promise<AssetForgeEmailResult> {
  try {
    const recruiter = await fetchRecruiterFromApollo({
      company: input.job.company,
      jobTitle: input.job.title,
    });

    if (!recruiter) {
      return buildAssetForgeSkipResult('recruiter_not_found');
    }

    const email = await generateAssetForgeEmail({
      job: input.job,
      recruiter,
      resumeSummary: input.resumeSummary,
      antiSlopEnabled: input.antiSlopEnabled,
      writingStyleContext: input.writingStyleContext,
    });

    return {
      status: 'generated',
      recruiter,
      email,
    };
  } catch (error) {
    console.error('Asset Forge email generation failed:', error);
    return buildAssetForgeSkipResult('apollo_error');
  }
}
```

- [ ] **Step 6: Preserve the current `generateColdEmail()` API**

Refactor `generateColdEmail()` to continue working for current callers:

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
      const prompt = `...existing compatibility prompt...`;
      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'anthropic/claude-opus-4.6'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty cold email generated');
      }
      return content.trim();
    },
    {
      jobTitle,
      company,
      resumeText,
      antiSlopEnabled,
      writingStyleContext,
    }
  );
}
```

Do not break existing dashboard and tracker callers in this phase.

- [ ] **Step 7: Run focused tests and lint**

Run:

```bash
npm test -- src/services/__tests__/assetForge.test.ts src/services/__tests__/validator.test.ts
npm run lint
```

Expected: PASS with Asset Forge tests green and no new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/aiService.ts src/services/apolloService.ts src/services/__tests__/assetForge.test.ts src/services/validator.ts src/services/__tests__/validator.test.ts
git commit -m "feat: add asset forge recruiter and email flow"
```

### Task 4: Final Verification

**Files:**
- Test: `src/services/__tests__/assetForge.test.ts`
- Test: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`
- Modify: `src/services/aiService.ts` if fixes are needed
- Modify: `src/services/apolloService.ts` if fixes are needed

- [ ] **Step 1: Run the focused suite**

Run:

```bash
npm test -- src/services/__tests__/assetForge.test.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts src/services/__tests__/phase3ScoutHarvester.test.ts
```

Expected: PASS with Asset Forge, validator, guardrail, and Scout/Harvester tests green.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: PASS with no new type errors introduced by Phase 5.

- [ ] **Step 3: Run a production build**

Run:

```bash
npm run build
```

Expected: PASS with the existing warning profile only.

- [ ] **Step 4: Manual smoke-check**

Verify these flows in the app or console:

```text
1. Call Asset Forge with a company that Apollo can resolve and confirm:
   - recruiter is returned
   - email is generated
   - output mentions company and role
2. Call Asset Forge with a company Apollo cannot resolve and confirm:
   - result status is "skipped"
   - reason is "recruiter_not_found"
3. Trigger legacy generateColdEmail() and confirm existing callers still work.
```

Expected:

```text
- Apollo is the primary recruiter source
- no recruiter results skip cleanly
- existing cold-email entry points still function
```

- [ ] **Step 5: Final commit**

```bash
git add src/services/apolloService.ts src/services/aiService.ts src/services/validator.ts src/services/__tests__/assetForge.test.ts src/services/__tests__/validator.test.ts
git commit -m "feat: add phase 5 asset forge"
```

## Self-Review

### Spec Coverage

- Apollo primary recruiter lookup: covered in Task 2
- skip-on-missing-recruiter behavior: covered in Task 3 and Task 4
- guarded cold-email asset generation: covered in Task 3
- deterministic validation for company/role/length: covered in Task 1
- compatibility with existing `generateColdEmail()` callers: covered in Task 3

### Placeholder Scan

- no `TBD`
- no `TODO`
- no unresolved file names
- no vague “add validation” or “handle errors” steps without code or commands

### Type Consistency

- `RecruiterContact`, `OutreachJobContext`, `AssetForgeEmailInput`, and `AssetForgeEmailResult` are defined once and reused consistently
- `email_generation` remains the guardrail task string everywhere in the plan
- `buildAssetForgeSkipResult()` is the only skip-result constructor referenced in the plan
