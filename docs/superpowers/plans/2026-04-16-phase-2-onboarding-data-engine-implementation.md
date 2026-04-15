# Phase 2 Onboarding Data Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw-text-only onboarding with a structured resume data pipeline that stores durable extraction artifacts, adds validator-owned hard filters, and keeps existing settings and dashboard flows working through compatibility fields.

**Architecture:** Extend the user profile schema in `AuthContext.tsx`, add deterministic cleaning and preference helpers to `validator.ts`, add AI-backed resume extraction and summary functions to `aiService.ts`, and rework `useResumeParser.ts` to run a staged onboarding pipeline. Keep `jobType`, `minSalary`, and `location` synchronized with the new nested `preferences` object so existing readers continue to work during migration.

**Tech Stack:** TypeScript, React, Firebase Firestore, Vitest, pdfjs-dist, mammoth

---

## File Structure

- Create: `src/services/__tests__/onboardingDataEngine.test.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/services/validator.ts`
- Modify: `src/services/aiService.ts`
- Modify: `src/hooks/useResumeParser.ts`
- Modify: `src/pages/Settings.tsx`

Each file has one clear role:

- `AuthContext.tsx`: adds Phase 2 profile types
- `validator.ts`: owns deterministic cleaning, preference normalization, preference validation, and job filter matching
- `aiService.ts`: adds structured resume extraction and summary generation
- `useResumeParser.ts`: orchestrates the staged onboarding data pipeline
- `Settings.tsx`: keeps the existing settings screen aligned with nested preferences plus legacy fields
- `onboardingDataEngine.test.ts`: verifies deterministic helpers and compatibility-sync behavior

### Task 1: Extend the Profile Schema

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`

- [ ] **Step 1: Write the failing type-oriented test scaffold**

Create `src/services/__tests__/onboardingDataEngine.test.ts` with this initial test block:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeResumeText,
  normalizeUserPreferences,
  syncLegacyPreferenceFields,
} from '../validator';

describe('phase 2 profile helpers', () => {
  it('syncs nested preferences to legacy profile fields', () => {
    const result = syncLegacyPreferenceFields({
      remoteOnly: true,
      salaryFloor: 150000,
      locations: ['San Francisco, CA', 'New York, NY'],
    });

    expect(result.jobType).toBe('remote');
    expect(result.minSalary).toBe(150000);
    expect(result.location).toBe('San Francisco, CA');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: FAIL because the new helper exports do not exist yet.

- [ ] **Step 3: Extend the profile types in `AuthContext.tsx`**

Add these interfaces above `UserProfile`:

```ts
export interface StructuredProfile {
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
}

export interface UserPreferences {
  remoteOnly: boolean;
  salaryFloor: number | null;
  locations: string[];
}
```

Extend `UserProfile` with:

```ts
  resumeRaw?: string;
  resumeCleaned?: string;
  resumeSummary?: string;
  structuredProfile?: StructuredProfile;
  preferences?: UserPreferences;
```

Keep these existing fields in place:

```ts
  jobType?: string;
  location?: string;
  minSalary?: number | null;
  resumeText?: string;
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS, or only failures from later unimplemented helpers if they are already imported elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx src/services/__tests__/onboardingDataEngine.test.ts
git commit -m "feat: extend user profile for onboarding data engine"
```

### Task 2: Add Deterministic Resume and Preference Helpers

**Files:**
- Modify: `src/services/validator.ts`
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`

- [ ] **Step 1: Expand the failing test file with deterministic helper coverage**

Append these tests to `src/services/__tests__/onboardingDataEngine.test.ts`:

```ts
describe('normalizeResumeText', () => {
  it('collapses repeated whitespace and trims noise', () => {
    const cleaned = normalizeResumeText('  Senior Engineer\\n\\nReact   TypeScript   ');
    expect(cleaned).toBe('Senior Engineer\nReact TypeScript');
  });
});

describe('normalizeUserPreferences', () => {
  it('normalizes remoteOnly, salaryFloor, and locations', () => {
    const normalized = normalizeUserPreferences({
      remoteOnly: 'true',
      salaryFloor: '180000',
      locations: [' New York, NY ', '', 'Remote'],
    });

    expect(normalized).toEqual({
      remoteOnly: true,
      salaryFloor: 180000,
      locations: ['New York, NY', 'Remote'],
    });
  });
});

describe('jobMatchesUserPreferences', () => {
  it('rejects non-remote jobs for remote-only users', () => {
    const match = jobMatchesUserPreferences(
      {
        isRemote: false,
        salary: '$200,000',
        location: 'San Francisco, CA',
      },
      {
        remoteOnly: true,
        salaryFloor: null,
        locations: [],
      }
    );

    expect(match.passed).toBe(false);
    expect(match.code).toBe('REMOTE_MISMATCH');
  });

  it('rejects jobs below the salary floor', () => {
    const match = jobMatchesUserPreferences(
      {
        isRemote: true,
        salary: '$90,000',
        location: 'Remote',
      },
      {
        remoteOnly: true,
        salaryFloor: 120000,
        locations: [],
      }
    );

    expect(match.passed).toBe(false);
    expect(match.code).toBe('SALARY_FLOOR_MISMATCH');
  });

  it('rejects jobs outside preferred locations when locations are set', () => {
    const match = jobMatchesUserPreferences(
      {
        isRemote: false,
        salary: '$150,000',
        location: 'Austin, TX',
      },
      {
        remoteOnly: false,
        salaryFloor: null,
        locations: ['New York, NY'],
      }
    );

    expect(match.passed).toBe(false);
    expect(match.code).toBe('LOCATION_MISMATCH');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: FAIL because the new validator helpers do not exist.

- [ ] **Step 3: Implement the deterministic helpers in `validator.ts`**

Add these exports near the top of `validator.ts`:

```ts
export interface UserPreferencesInput {
  remoteOnly?: unknown;
  salaryFloor?: unknown;
  locations?: unknown;
}

export interface NormalizedUserPreferences {
  remoteOnly: boolean;
  salaryFloor: number | null;
  locations: string[];
}

export interface LegacyPreferenceFields {
  jobType: 'remote' | 'both';
  minSalary: number | null;
  location: string;
}

export function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0))
    .join('\n')
    .trim();
}

export function normalizeUserPreferences(input: UserPreferencesInput): NormalizedUserPreferences {
  const remoteOnly =
    input.remoteOnly === true ||
    input.remoteOnly === 'true' ||
    input.remoteOnly === 'remote';

  const salaryFloorRaw =
    typeof input.salaryFloor === 'string'
      ? Number.parseInt(input.salaryFloor, 10)
      : typeof input.salaryFloor === 'number'
        ? input.salaryFloor
        : null;

  const salaryFloor =
    typeof salaryFloorRaw === 'number' && Number.isFinite(salaryFloorRaw) && salaryFloorRaw > 0
      ? salaryFloorRaw
      : null;

  const rawLocations = Array.isArray(input.locations)
    ? input.locations
    : typeof input.locations === 'string'
      ? input.locations.split(',')
      : [];

  const locations = Array.from(
    new Set(
      rawLocations
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );

  return { remoteOnly, salaryFloor, locations };
}

export function syncLegacyPreferenceFields(
  preferences: NormalizedUserPreferences
): LegacyPreferenceFields {
  return {
    jobType: preferences.remoteOnly ? 'remote' : 'both',
    minSalary: preferences.salaryFloor,
    location: preferences.locations[0] || '',
  };
}

function parseSalaryFloorCandidate(salaryText: string): number | null {
  const matches = salaryText.replace(/,/g, '').match(/\d{2,}/g);
  if (!matches || matches.length === 0) return null;
  return Math.max(...matches.map((value) => Number.parseInt(value, 10)));
}

export function jobMatchesUserPreferences(
  job: { isRemote: boolean; salary?: string; location: string },
  preferences: NormalizedUserPreferences
): ValidationResult {
  if (preferences.remoteOnly && !job.isRemote) {
    return {
      passed: false,
      code: 'REMOTE_MISMATCH',
      reason: 'Job does not match the remote-only preference.',
    };
  }

  if (preferences.salaryFloor !== null) {
    const parsedSalary = parseSalaryFloorCandidate(job.salary || '');
    if (parsedSalary !== null && parsedSalary < preferences.salaryFloor) {
      return {
        passed: false,
        code: 'SALARY_FLOOR_MISMATCH',
        reason: 'Job salary is below the required salary floor.',
      };
    }
  }

  if (preferences.locations.length > 0) {
    const normalizedLocation = job.location.toLowerCase();
    const matchesLocation = preferences.locations.some((location) =>
      normalizedLocation.includes(location.toLowerCase())
    );

    if (!matchesLocation && !job.isRemote) {
      return {
        passed: false,
        code: 'LOCATION_MISMATCH',
        reason: 'Job location does not match preferred locations.',
      };
    }
  }

  return { passed: true };
}
```

- [ ] **Step 4: Run the deterministic helper tests**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: PASS for the new helper tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/validator.ts src/services/__tests__/onboardingDataEngine.test.ts
git commit -m "feat: add onboarding data engine validators"
```

### Task 3: Add Structured Resume Extraction and Summary

**Files:**
- Modify: `src/services/aiService.ts`
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`

- [ ] **Step 1: Add the failing extraction tests**

Append this lightweight contract test to `src/services/__tests__/onboardingDataEngine.test.ts`:

```ts
import { validateStructuredProfile } from '../validator';

describe('validateStructuredProfile', () => {
  it('accepts a complete structured profile shape', () => {
    const result = validateStructuredProfile({
      skills: ['react'],
      techStack: ['typescript', 'firebase'],
      seniority: 'senior',
      roles: ['Frontend Engineer'],
      industries: ['SaaS'],
    });

    expect(result.passed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: FAIL because `validateStructuredProfile` does not exist yet.

- [ ] **Step 3: Add structured profile validation to `validator.ts`**

Append this validator:

```ts
export function validateStructuredProfile(profile: unknown): ValidationResult {
  if (!profile || typeof profile !== 'object') {
    return {
      passed: false,
      code: 'INVALID_STRUCTURED_PROFILE',
      reason: 'Structured profile must be an object.',
    };
  }

  const candidate = profile as Record<string, unknown>;
  const requiredArrayKeys = ['skills', 'techStack', 'roles', 'industries'];

  for (const key of requiredArrayKeys) {
    if (!Array.isArray(candidate[key])) {
      return {
        passed: false,
        code: 'INVALID_STRUCTURED_PROFILE',
        reason: `Structured profile field "${key}" must be an array.`,
      };
    }
  }

  if (typeof candidate.seniority !== 'string') {
    return {
      passed: false,
      code: 'INVALID_STRUCTURED_PROFILE',
      reason: 'Structured profile field "seniority" must be a string.',
    };
  }

  return { passed: true };
}
```

- [ ] **Step 4: Add the new AI extraction functions to `aiService.ts`**

Add imports:

```ts
import { validateStructuredProfile } from './validator';
```

Add these exports after `extractJobPreferences()`:

```ts
export interface ExtractedResumeProfile {
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
}

export async function extractResume(
  resumeText: string
): Promise<ExtractedResumeProfile | null> {
  const prompt = `Extract a structured candidate profile from this resume.

Return a JSON object:
{
  "skills": [],
  "techStack": [],
  "seniority": "",
  "roles": [],
  "industries": []
}

Rules:
- Use only information present in the resume.
- Do not invent experience.
- Deduplicate repeated concepts.
- Keep arrays concise.

Resume:
${resumeText.substring(0, 6000)}`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { type: 'json_object' },
      'openai/gpt-5.4-pro'
    );

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validation = validateStructuredProfile(parsed);
    if (!validation.passed) {
      throw new Error(validation.reason || 'Invalid structured profile');
    }

    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      seniority: typeof parsed.seniority === 'string' ? parsed.seniority : '',
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
    };
  } catch (error) {
    console.error('Error extracting structured resume:', error);
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return null;
  }
}

export async function summarizeResume(
  resumeText: string
): Promise<string> {
  const prompt = `Summarize this resume in 80 words or fewer.

Rules:
- Keep it factual.
- Mention seniority, strongest skills, and role direction.
- Do not invent information.

Resume:
${resumeText.substring(0, 6000)}`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'google/gemini-3.1-pro'
    );
    return response.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Error summarizing resume:', error);
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return '';
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
npm run lint
```

Expected: PASS for tests and no type errors from the new extraction exports.

- [ ] **Step 6: Commit**

```bash
git add src/services/validator.ts src/services/aiService.ts src/services/__tests__/onboardingDataEngine.test.ts
git commit -m "feat: add structured resume extraction pipeline"
```

### Task 4: Rework the Resume Upload Pipeline

**Files:**
- Modify: `src/hooks/useResumeParser.ts`
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Import the new helpers**

Update `src/hooks/useResumeParser.ts` imports:

```ts
import {
  normalizeResumeText,
  normalizeUserPreferences,
  syncLegacyPreferenceFields,
} from '../services/validator';
```

Replace the AI import usage with:

```ts
const {
  analyzeResume,
  extractJobPreferences,
  extractResume,
  summarizeResume,
} = await import('../services/aiService');
```

- [ ] **Step 2: Add the staged onboarding pipeline**

Replace the current `text`-only save flow with:

```ts
const resumeRaw = text;
const resumeCleaned = normalizeResumeText(resumeRaw);

let structuredProfile = profile?.structuredProfile || null;
let resumeSummary = profile?.resumeSummary || '';
let paths = profile?.careerPaths || [];
let analysis = profile?.resumeAnalysis;

const extractedPreferences = await extractJobPreferences(resumeCleaned);
const normalizedPreferences = normalizeUserPreferences({
  remoteOnly:
    extractedPreferences?.jobType === 'remote' ||
    profile?.preferences?.remoteOnly,
  salaryFloor:
    extractedPreferences?.minSalary ?? profile?.preferences?.salaryFloor ?? null,
  locations:
    extractedPreferences?.location
      ? [extractedPreferences.location]
      : profile?.preferences?.locations || [],
});

const legacyPreferenceFields = syncLegacyPreferenceFields(normalizedPreferences);

structuredProfile = await extractResume(resumeCleaned);
resumeSummary = await summarizeResume(resumeCleaned);

const suggestedPaths = await suggestCareerPaths(
  resumeCleaned,
  profile?.antiSlopEnabled !== false
);
if (suggestedPaths && suggestedPaths.length > 0) {
  paths = suggestedPaths;
}

const resumeAnalysis = await analyzeResume(resumeCleaned, paths);
if (resumeAnalysis) {
  analysis = resumeAnalysis;
}

await updateProfile({
  resumeRaw,
  resumeCleaned,
  resumeSummary,
  structuredProfile: structuredProfile || undefined,
  preferences: normalizedPreferences,
  resumeText: resumeCleaned,
  careerPaths: paths,
  resumeAnalysis: analysis,
  jobType: legacyPreferenceFields.jobType,
  minSalary: legacyPreferenceFields.minSalary,
  location: legacyPreferenceFields.location,
});
```

- [ ] **Step 3: Preserve failure behavior correctly**

Keep these rules in the final implementation:

```ts
- parsing failure stops the pipeline before updateProfile()
- AI_QUOTA_EXCEEDED still surfaces the existing quota toast
- structured extraction failure does not fabricate a structured profile
- successful parsing still saves resumeRaw and resumeCleaned
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with the new Phase 2 profile fields recognized.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useResumeParser.ts src/contexts/AuthContext.tsx
git commit -m "feat: add staged onboarding data pipeline"
```

### Task 5: Keep Settings Compatible With Nested Preferences

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/services/validator.ts`

- [ ] **Step 1: Read from nested preferences first**

Update the `useEffect` initializer in `Settings.tsx` to prefer nested values:

```ts
      setFormData({
        careerPaths: profile.careerPaths || [],
        jobType:
          profile.preferences?.remoteOnly === true
            ? 'remote'
            : profile.jobType || 'both',
        location: profile.preferences?.locations?.[0] || profile.location || '',
        minSalary:
          profile.preferences?.salaryFloor?.toString() ||
          profile.minSalary?.toString() ||
          '',
        resumeText: profile.resumeText || '',
        resumeAnalysis: profile.resumeAnalysis,
        receiveDailyAlerts: profile.receiveDailyAlerts !== false,
        antiSlopEnabled: profile.antiSlopEnabled !== false,
      });
```

- [ ] **Step 2: Save nested preferences and legacy fields together**

Update `handleSave()` to normalize and sync:

```ts
    const preferences = normalizeUserPreferences({
      remoteOnly: formData.jobType === 'remote',
      salaryFloor: formData.minSalary,
      locations: formData.location ? [formData.location] : [],
    });

    const legacy = syncLegacyPreferenceFields(preferences);

    await updateProfile({
      careerPaths: formData.careerPaths,
      preferences,
      jobType: legacy.jobType,
      location: legacy.location,
      minSalary: legacy.minSalary,
      resumeText: formData.resumeText,
      resumeAnalysis: formData.resumeAnalysis,
      receiveDailyAlerts: formData.receiveDailyAlerts,
      antiSlopEnabled: formData.antiSlopEnabled,
    });
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with Settings still compiling against the new preference shape.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx src/services/validator.ts
git commit -m "feat: sync settings with onboarding preferences"
```

### Task 6: Final Verification

**Files:**
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`
- Test: `src/services/__tests__/validator.test.ts`
- Test: `src/services/__tests__/systemEngine.test.ts`
- Modify: `src/hooks/useResumeParser.ts` if final fixes are required
- Modify: `src/pages/Settings.tsx` if final fixes are required

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts
```

Expected: PASS with all onboarding, validator, and guardrail tests green.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: PASS with no new type errors introduced by Phase 2.

- [ ] **Step 3: Smoke-check the onboarding data flow manually**

Verify these flows in the app:

```text
1. Upload a resume on onboarding and confirm the user doc stores:
   - resumeRaw
   - resumeCleaned
   - resumeSummary
   - structuredProfile
   - preferences
2. Confirm legacy fields still exist:
   - resumeText
   - jobType
   - minSalary
   - location
3. Open Settings and verify the saved values still appear correctly.
```

Expected:

```text
- onboarding stores both raw and structured resume artifacts
- preferences is present and deterministic
- compatibility fields remain synced
- existing settings behavior still works
```

- [ ] **Step 4: Final commit**

```bash
git add src/contexts/AuthContext.tsx src/services/validator.ts src/services/aiService.ts src/hooks/useResumeParser.ts src/pages/Settings.tsx src/services/__tests__/onboardingDataEngine.test.ts
git commit -m "feat: add phase 2 onboarding data engine"
```

## Self-Review

### Spec Coverage

- structured resume artifacts: covered in Tasks 1, 3, and 4
- nested `preferences` plus compatibility fields: covered in Tasks 2, 4, and 5
- validator ownership of hard filters: covered in Task 2
- onboarding pipeline migration without UI redesign: covered in Tasks 4 and 5

### Placeholder Scan

- no `TBD`
- no `TODO`
- no unresolved file names
- no vague “add validation” steps without code or commands

### Type Consistency

- `StructuredProfile`, `UserPreferences`, and compatibility sync helpers are named consistently
- `resumeRaw`, `resumeCleaned`, `resumeSummary`, and `structuredProfile` are used consistently across tasks
- `normalizeUserPreferences()` and `syncLegacyPreferenceFields()` are the only preference-normalization path referenced in the plan
