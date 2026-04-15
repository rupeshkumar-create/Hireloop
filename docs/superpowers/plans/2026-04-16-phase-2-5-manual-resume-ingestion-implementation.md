# Phase 2.5 Manual Resume Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pasted or manually edited resume text go through the same structured ingestion pipeline as file uploads, while skipping expensive AI work when the normalized resume content has not changed.

**Architecture:** Extract a shared `processResumeText()` function from `useResumeParser.ts`, keep file parsing separate in `handleFileUpload()`, add deterministic change detection helpers to `validator.ts`, and update `Settings.tsx` so save chooses between a cheap settings-only path and full resume ingestion. This keeps one ingestion engine for both file uploads and pasted resume text.

**Tech Stack:** TypeScript, React, Firebase Firestore, Vitest, pdfjs-dist, mammoth

---

## File Structure

- Modify: `src/services/validator.ts`
- Modify: `src/services/__tests__/onboardingDataEngine.test.ts`
- Modify: `src/hooks/useResumeParser.ts`
- Modify: `src/pages/Settings.tsx`

Each file has one clear purpose:

- `validator.ts`: owns normalization-based resume change detection
- `onboardingDataEngine.test.ts`: verifies deterministic change detection behavior
- `useResumeParser.ts`: becomes the single source of truth for resume ingestion
- `Settings.tsx`: decides when save should trigger full structured ingestion

### Task 1: Add Resume Change Detection Helpers

**Files:**
- Modify: `src/services/validator.ts`
- Modify: `src/services/__tests__/onboardingDataEngine.test.ts`
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `src/services/__tests__/onboardingDataEngine.test.ts`:

```ts
import { hasResumeTextChanged } from '../validator';

describe('hasResumeTextChanged', () => {
  it('returns false when only whitespace changes', () => {
    expect(
      hasResumeTextChanged(
        'Senior Engineer\n\nReact TypeScript',
        '  Senior Engineer\r\n\r\nReact   TypeScript   '
      )
    ).toBe(false);
  });

  it('returns true when the resume content changes', () => {
    expect(
      hasResumeTextChanged(
        'Senior Engineer\n\nReact TypeScript',
        'Senior Engineer\n\nReact TypeScript\nGraphQL'
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: FAIL because `hasResumeTextChanged` does not exist yet.

- [ ] **Step 3: Implement the helper in `validator.ts`**

Add this export below `normalizeResumeText()`:

```ts
export function hasResumeTextChanged(
  savedResumeCleaned: string,
  draftResumeText: string
): boolean {
  const normalizedSaved = normalizeResumeText(savedResumeCleaned || '');
  const normalizedDraft = normalizeResumeText(draftResumeText || '');
  return normalizedSaved !== normalizedDraft;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts
```

Expected: PASS with the new change-detection tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/validator.ts src/services/__tests__/onboardingDataEngine.test.ts
git commit -m "feat: add resume change detection helper"
```

### Task 2: Extract Shared Resume Processing

**Files:**
- Modify: `src/hooks/useResumeParser.ts`
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`

- [ ] **Step 1: Add the shared processor signature**

In `src/hooks/useResumeParser.ts`, replace the current one-path structure with this shape:

```ts
async function processResumeText(
  rawText: string,
  options?: { onSuccess?: () => void; successMessage?: string }
) {
  const resumeRaw = rawText;
  const resumeCleaned = normalizeResumeText(resumeRaw);

  if (!resumeCleaned) {
    toast.error('The provided resume text did not contain readable content.');
    return false;
  }

  let paths = profile?.careerPaths || [];
  let analysis = profile?.resumeAnalysis;
  let structuredProfile = profile?.structuredProfile;
  let resumeSummary = profile?.resumeSummary || '';

  toast.info('Analyzing resume for structured profile and preferences...');
  const {
    analyzeResume,
    extractJobPreferences,
    extractResume,
    summarizeResume,
  } = await import('../services/aiService');

  const extractedPreferences = await extractJobPreferences(resumeCleaned);
  const normalizedPreferences = normalizeUserPreferences({
    remoteOnly:
      extractedPreferences?.jobType === 'remote' ||
      profile?.preferences?.remoteOnly,
    salaryFloor:
      extractedPreferences?.minSalary ??
      profile?.preferences?.salaryFloor ??
      null,
    locations: extractedPreferences?.location
      ? [extractedPreferences.location]
      : profile?.preferences?.locations || [],
  });
  const legacyPreferenceFields = syncLegacyPreferenceFields(normalizedPreferences);

  const extractedStructuredProfile = await extractResume(resumeCleaned);
  if (extractedStructuredProfile) {
    structuredProfile = extractedStructuredProfile;
  }

  const extractedResumeSummary = await summarizeResume(resumeCleaned);
  if (extractedResumeSummary) {
    resumeSummary = extractedResumeSummary;
  }

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
    structuredProfile,
    preferences: normalizedPreferences,
    resumeText: resumeCleaned,
    careerPaths: paths,
    resumeAnalysis: analysis,
    jobType: legacyPreferenceFields.jobType,
    minSalary: legacyPreferenceFields.minSalary,
    location: legacyPreferenceFields.location,
  });

  toast.success(options?.successMessage || 'Resume processed successfully!');
  options?.onSuccess?.();
  return true;
}
```

- [ ] **Step 2: Refactor `handleFileUpload()` to delegate**

Replace the ingestion body of `handleFileUpload()` with:

```ts
await processResumeText(text, {
  onSuccess,
  successMessage: 'Resume uploaded successfully!',
});
```

Keep file parsing, size checks, file-type checks, and parse-error toasts in `handleFileUpload()`.

- [ ] **Step 3: Export the shared function from the hook**

Update the return value:

```ts
return {
  analyzingResume,
  handleFileUpload,
  processResumeText,
};
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with no type errors from the refactor.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useResumeParser.ts
git commit -m "refactor: share resume text ingestion pipeline"
```

### Task 3: Trigger Full Ingestion From Settings Save

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/hooks/useResumeParser.ts`

- [ ] **Step 1: Import the change-detection helper**

Update imports in `src/pages/Settings.tsx`:

```ts
import {
  hasResumeTextChanged,
  normalizeUserPreferences,
  syncLegacyPreferenceFields,
} from '../services/validator';
```

Update the hook usage:

```ts
const { analyzingResume, handleFileUpload, processResumeText } = useResumeParser(
  updateProfile,
  profile
);
```

- [ ] **Step 2: Branch `handleSave()` based on resume changes**

Replace the current save flow with:

```ts
  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = normalizeUserPreferences({
        remoteOnly: formData.jobType === 'remote',
        salaryFloor: formData.minSalary,
        locations: formData.location ? [formData.location] : [],
      });
      const legacy = syncLegacyPreferenceFields(preferences);

      const resumeChanged = hasResumeTextChanged(
        profile?.resumeCleaned || profile?.resumeText || '',
        formData.resumeText
      );

      if (resumeChanged) {
        const processed = await processResumeText(formData.resumeText, {
          successMessage: 'Preferences and resume updated.',
        });

        if (!processed) {
          setSaving(false);
          return;
        }

        await updateProfile({
          preferences,
          jobType: legacy.jobType,
          location: legacy.location,
          minSalary: legacy.minSalary,
          receiveDailyAlerts: formData.receiveDailyAlerts,
          antiSlopEnabled: formData.antiSlopEnabled,
        });
      } else {
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
      }

      toast.success('Preferences saved.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 3: Tighten the shared processor return contract**

In `useResumeParser.ts`, make `processResumeText()` explicitly return `Promise<boolean>`:

```ts
async function processResumeText(
  rawText: string,
  options?: { onSuccess?: () => void; successMessage?: string }
): Promise<boolean> {
```

Return `false` for empty cleaned text or processing failure, and `true` after a successful `updateProfile()`.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with `Settings.tsx` compiling against the new hook contract.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx src/hooks/useResumeParser.ts
git commit -m "feat: run full ingestion for pasted resume text on save"
```

### Task 4: Preserve Error Behavior and Manual Save Semantics

**Files:**
- Modify: `src/hooks/useResumeParser.ts`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Keep quota and processing errors consistent**

Ensure `processResumeText()` retains this catch block behavior:

```ts
    } catch (error: any) {
      if (error.message === 'AI_QUOTA_EXCEEDED') {
        toast.error(
          'AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to analyze your resume.',
          { duration: 6000 }
        );
      } else {
        console.error('Error saving resume to Firestore:', error);
        toast.error(`Failed to save resume: ${error.message || 'Unknown error'}`);
      }
      return false;
    } finally {
      setAnalyzingResume(false);
    }
```

- [ ] **Step 2: Avoid duplicate success toasts**

In `Settings.tsx`, change the final success block to:

```ts
      if (!resumeChanged) {
        toast.success('Preferences saved.');
      }
```

This avoids showing one success toast from `processResumeText()` and another from `handleSave()`.

- [ ] **Step 3: Keep the cheap path cheap**

Ensure the unchanged-resume branch keeps using:

```ts
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

Do not call `processResumeText()` in this branch.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with no regressions from the save-flow refinement.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useResumeParser.ts src/pages/Settings.tsx
git commit -m "fix: preserve save semantics for manual resume ingestion"
```

### Task 5: Final Verification

**Files:**
- Test: `src/services/__tests__/onboardingDataEngine.test.ts`
- Modify: `src/hooks/useResumeParser.ts` if fixes are needed
- Modify: `src/pages/Settings.tsx` if fixes are needed

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npm test -- src/services/__tests__/onboardingDataEngine.test.ts src/services/__tests__/validator.test.ts src/services/__tests__/systemEngine.test.ts
```

Expected: PASS with all onboarding and guardrail tests green.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run lint
```

Expected: PASS with no new type errors introduced by Phase 2.5.

- [ ] **Step 3: Run a production build**

Run:

```bash
npm run build
```

Expected: PASS with the existing warning profile unchanged.

- [ ] **Step 4: Manual smoke-check**

Verify these flows in the app:

```text
1. Upload a resume file and confirm structured fields still save correctly.
2. Paste a materially changed resume into Settings and click Save Preferences.
3. Confirm `resumeRaw`, `resumeCleaned`, `resumeSummary`, and `structuredProfile` refresh.
4. Save again with only whitespace changes and confirm no extra ingestion work is triggered.
5. Save non-resume settings changes and confirm they still persist without reprocessing the resume.
```

Expected:

```text
- one ingestion engine is used for file and pasted text
- unchanged text skips AI work
- changed text refreshes structured artifacts
- settings updates still work normally
```

- [ ] **Step 5: Final commit**

```bash
git add src/services/validator.ts src/services/__tests__/onboardingDataEngine.test.ts src/hooks/useResumeParser.ts src/pages/Settings.tsx
git commit -m "feat: unify manual and file resume ingestion"
```

## Self-Review

### Spec Coverage

- shared ingestion engine: covered in Task 2
- save-time trigger for manual pasted text: covered in Task 3
- deterministic change detection: covered in Task 1
- error and save semantics: covered in Task 4

### Placeholder Scan

- no `TBD`
- no `TODO`
- no unresolved file names
- no vague steps without code or commands

### Type Consistency

- `processResumeText()` is the shared ingestion entry point across tasks
- `hasResumeTextChanged()` is the only resume change detector referenced in the plan
- file upload remains `handleFileUpload()` and delegates to the shared processor consistently
