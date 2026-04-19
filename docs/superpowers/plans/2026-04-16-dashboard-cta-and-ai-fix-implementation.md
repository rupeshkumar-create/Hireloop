# Dashboard CTA And AI Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the daily matches dashboard so `Apply Now` behaves consistently, `Save Job` immediately flips to a saved state, and `Interview Q/A` generation in the job details flow provides reliable visible feedback.

**Architecture:** Keep the current dashboard/backend contracts intact and solve the issues at the frontend boundary. Add one small shared helper for resolving the best application URL, wire saved-state into `JobDetailsPanel`, and harden the interview-action feedback in `useDashboardAI` so silent no-op states disappear without changing the overall dashboard layout.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Vitest, existing dashboard hooks/components

---

## File Map (Planned Changes)

**Create**
- `src/lib/jobLinks.ts`
  - Resolve the best outbound application URL for a daily job
- `src/lib/__tests__/jobLinks.test.ts`
  - Focused resolver tests

**Modify**
- `src/components/dashboard/JobDetailsPanel.tsx`
  - Use shared application-link resolver
  - Receive and render `isSaved` / `isSaving`
  - Show explicit apply/save feedback
- `src/components/dashboard/MatchesTab.tsx`
  - Use shared application-link resolver
  - Keep inline save/apply behavior aligned with the modal
- `src/components/dashboard/__tests__/MatchesTab.test.ts`
  - Add coverage for missing-URL and saved-state output
- `src/pages/Dashboard.tsx`
  - Pass saved-state and save-in-progress state into `JobDetailsPanel`
- `src/hooks/useDashboardAI.ts`
  - Tighten `interview` action handling and error/result feedback
- `src/hooks/useDashboardJobs.ts`
  - Expose enough save-in-progress state if needed by the modal path

## Task 1: Add a Shared Application URL Resolver

**Files:**
- Create: `src/lib/jobLinks.ts`
- Create: `src/lib/__tests__/jobLinks.test.ts`

- [ ] **Step 1: Create the resolver helper**

Create `src/lib/jobLinks.ts`:

```ts
import type { Job } from './adminUsers'; // replace with the correct app job type import
```

Replace the placeholder import above with the correct import and use this implementation:

```ts
import type { Job } from '../types/dashboard';

function isValidHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export function resolveJobApplicationUrl(job: Job | null | undefined): string | null {
  if (!job) return null;

  const candidates: unknown[] = [
    (job as any).applyUrl,
    (job as any).url,
    (job as any).applicationUrl,
    (job as any).jobUrl,
  ];

  for (const candidate of candidates) {
    if (isValidHttpUrl(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}
```

- [ ] **Step 2: Add focused resolver tests**

Create `src/lib/__tests__/jobLinks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveJobApplicationUrl } from '../jobLinks';
import type { Job } from '../../types/dashboard';

const baseJob: Job = {
  id: 'job-1',
  fingerprint: 'job-1',
  title: 'Customer Success Operations Manager',
  company: 'Superside',
  location: 'Remote',
  workType: 'remote',
  salary: '$65,000 - $85,000',
  description: 'Coordinate customer success operations',
  requirements: [],
  source: 'perplexity',
  postedAt: new Date().toISOString(),
  matchScore: 92,
  finalScore: 92,
  matchReasons: [],
  skillGaps: [],
  aiSummary: '',
  isHotJob: false,
};

describe('resolveJobApplicationUrl', () => {
  it('uses applyUrl when present', () => {
    expect(
      resolveJobApplicationUrl({ ...baseJob, applyUrl: 'https://example.com/apply' })
    ).toBe('https://example.com/apply');
  });

  it('falls back to url when applyUrl is missing', () => {
    expect(
      resolveJobApplicationUrl({ ...(baseJob as any), url: 'https://example.com/url' })
    ).toBe('https://example.com/url');
  });

  it('returns null when no valid application url exists', () => {
    expect(resolveJobApplicationUrl(baseJob)).toBeNull();
    expect(
      resolveJobApplicationUrl({ ...(baseJob as any), applyUrl: 'not-a-link' })
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run the new tests**

Run:

```bash
npm test -- src/lib/__tests__/jobLinks.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/jobLinks.ts src/lib/__tests__/jobLinks.test.ts
git commit -m "test(dashboard): cover daily job application link resolution"
```

## Task 2: Fix Apply Now in the Job Details Panel

**Files:**
- Modify: `src/components/dashboard/JobDetailsPanel.tsx`

- [ ] **Step 1: Import and use the shared application-link resolver**

Add:

```ts
import { resolveJobApplicationUrl } from '../../lib/jobLinks';
```

Then inside the component, derive:

```ts
const applyUrl = resolveJobApplicationUrl(selectedJob);
```

Replace the current Apply Now click handler with:

```tsx
onClick={() => {
  trackJobClick(selectedJob);

  if (!applyUrl) {
    toast.error('Application link unavailable for this job.');
    return;
  }

  window.open(applyUrl, '_blank', 'noopener,noreferrer');
}}
```

- [ ] **Step 2: Make the apply CTA visibly unavailable when needed**

Update the button props:

```tsx
disabled={!applyUrl}
title={applyUrl ? 'Open application link' : 'Application link unavailable'}
```

This removes the silent no-op feeling even before the click.

- [ ] **Step 3: Run type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/JobDetailsPanel.tsx
git commit -m "fix(dashboard): normalize apply now behavior in job details"
```

## Task 3: Wire Saved-State Into the Job Details Panel

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/dashboard/JobDetailsPanel.tsx`

- [ ] **Step 1: Expand `JobDetailsPanelProps` with saved-state props**

Update the prop interface in `src/components/dashboard/JobDetailsPanel.tsx`:

```ts
interface JobDetailsPanelProps {
  selectedJob: Job;
  saveJob: (j: Job) => Promise<boolean>;
  dismissJob: (j: Job) => void;
  trackJobClick: (j: Job) => void;
  handleAiAction: (a: AiActionType, j: Job) => void;
  aiAction: AiActionType;
  aiResult: string | string[];
  actionLoading: boolean;
  downloadResume: (j: Job | null) => void;
  onClose: () => void;
  isSaved: boolean;
  isSaving: boolean;
}
```

- [ ] **Step 2: Update the save button rendering**

In `JobDetailsPanel.tsx`, replace the save button block with:

```tsx
<Button
  variant={isSaved ? 'secondary' : 'outline'}
  size="lg"
  className="border-border bg-surface"
  disabled={isSaved || isSaving}
  onClick={async () => {
    await saveJob(selectedJob);
  }}
  title={isSaved ? 'Already saved to tracker' : 'Save to Tracker'}
>
  <BookmarkPlus className="h-5 w-5" />
  {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save Job'}
</Button>
```

- [ ] **Step 3: Pass saved-state from `Dashboard.tsx`**

In `src/pages/Dashboard.tsx`, add a save-in-progress state near `savedJobFingerprints`:

```ts
const [savingJobFingerprints, setSavingJobFingerprints] = useState<string[]>([]);
```

Update `handleSaveJob`:

```ts
const handleSaveJob = async (job: Job) => {
  const fp = jobFingerprint(job.title, job.company);
  if (savingJobFingerprints.includes(fp) || savedJobFingerprints.includes(fp)) {
    return false;
  }

  setSavingJobFingerprints((cur) => [...cur, fp]);
  try {
    const didSave = await saveJob(job);
    if (!didSave) return false;
    setSavedJobFingerprints((cur) => (cur.includes(fp) ? cur : [...cur, fp]));
    return true;
  } finally {
    setSavingJobFingerprints((cur) => cur.filter((value) => value !== fp));
  }
};
```

Then pass:

```tsx
isSaved={selectedJob ? savedJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company)) : false}
isSaving={selectedJob ? savingJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company)) : false}
```

to `JobDetailsPanel`.

- [ ] **Step 4: Run type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/components/dashboard/JobDetailsPanel.tsx
git commit -m "fix(dashboard): show saved state in job details panel"
```

## Task 4: Align MatchesTab Save and Apply Feedback

**Files:**
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/components/dashboard/__tests__/MatchesTab.test.ts`

- [ ] **Step 1: Use the shared application-link resolver in MatchesTab**

Add:

```ts
import { resolveJobApplicationUrl } from '../../lib/jobLinks';
```

Then in `InlineJobDetail`, derive:

```ts
const applyUrl = resolveJobApplicationUrl(job);
```

Replace:

```tsx
{job.applyUrl && (
  <a href={job.applyUrl} ...>
```

with:

```tsx
{applyUrl && (
  <a href={applyUrl} ...>
```

- [ ] **Step 2: Align button labels**

Update the save CTA text in `InlineJobDetail`:

```tsx
{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save Job'}
```

This keeps the inline card and details modal language consistent.

- [ ] **Step 3: Expand MatchesTab tests**

Add tests in `src/components/dashboard/__tests__/MatchesTab.test.ts`:

```ts
it('uses a fallback url field for the apply link when applyUrl is missing', () => {
  const html = renderMatches('pro', [{ ...(sampleJob as any), applyUrl: undefined, url: 'https://example.com/fallback' }]);
  expect(html).toContain('https://example.com/fallback');
});

it('does not render the apply link when no valid application url exists', () => {
  const html = renderMatches('pro', [{ ...sampleJob, applyUrl: undefined }]);
  expect(html).not.toContain('Apply externally');
});

it('shows the short saved label for recently saved jobs', () => {
  const html = renderMatches('pro', [sampleJob], ['frontend engineer::acme']);
  expect(html).toContain('Saved');
});
```

- [ ] **Step 4: Run the focused component tests**

Run:

```bash
npm test -- src/components/dashboard/__tests__/MatchesTab.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/MatchesTab.tsx src/components/dashboard/__tests__/MatchesTab.test.ts
git commit -m "fix(dashboard): align daily match apply and save states"
```

## Task 5: Harden Interview Q/A Feedback in the Dashboard AI Hook

**Files:**
- Modify: `src/hooks/useDashboardAI.ts`

- [ ] **Step 1: Make interview failures explicit and resilient**

Update the `interview` action branch to reject empty results clearly:

```ts
} else if (action === 'interview') {
  const questions = await aiService.generateInterviewQuestions(
    job.title,
    job.company,
    profile?.antiSlopEnabled !== false
  );

  const hasQuestions =
    (Array.isArray(questions) && questions.length > 0) ||
    (typeof questions === 'string' && questions.trim().length > 0);

  if (!hasQuestions) {
    throw new Error('Interview Q/A could not be generated for this job.');
  }

  setAiResult(questions);
}
```

- [ ] **Step 2: Keep loading cleanup in a `finally` block**

Refactor `handleAiAction` so loading always resets:

```ts
const handleAiAction = async (action: AiActionType, job: Job) => {
  setAiAction(action);
  setActionLoading(true);
  setAiResult('');

  try {
    const aiService = await import('../services/aiService');
    // existing action branches...
  } catch (error: any) {
    if (error.message === 'AI_QUOTA_EXCEEDED') {
      toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.', { duration: 6000 });
    } else if (action === 'interview') {
      toast.error(error.message || 'Failed to generate interview Q/A.');
    } else {
      toast.error(error.message || 'Failed to generate AI content.');
    }
  } finally {
    setActionLoading(false);
  }
};
```

- [ ] **Step 3: Run type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDashboardAI.ts
git commit -m "fix(dashboard): harden interview ai action feedback"
```

## Task 6: Final Verification

**Files:**
- No new files required

- [ ] **Step 1: Run the focused tests**

Run:

```bash
npm test -- src/lib/__tests__/jobLinks.test.ts
npm test -- src/components/dashboard/__tests__/MatchesTab.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run the final type-check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Manual dashboard verification**

Run:

```bash
npm run dev
```

Verify:

- a job with a valid application link opens a new tab from `Apply Now`
- a job with no valid application link shows a clear unavailable state / toast
- clicking `Save Job` in the details panel changes the CTA to `Saved`
- clicking `Save Job` in an expanded inline card also shows `Saved`
- clicking `Interview Prep` shows loading and then renders interview content
- a failed interview generation shows a specific toast instead of appearing broken

---

## Spec Coverage Self-Review

- Apply Now reliability: covered by Tasks 1, 2, and 4.
- Immediate saved-state feedback: covered by Tasks 3 and 4.
- Interview Q/A visibility and failure handling: covered by Task 5.
- Frontend-only scope: maintained across all tasks with no backend contract changes.
