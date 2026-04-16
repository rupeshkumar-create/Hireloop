# Paid Assets And One-Click Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix paid-user AI asset persistence for cold email and interview Q&A, and add one-click save from Daily Matches.

**Architecture:** Widen Firestore validation so tracked jobs can store interview prep as either Markdown text or a list, then make tracked-job asset persistence resilient by saving each successful field independently. Add a dedicated save action to each Daily Match card so users can save without opening the detail modal.

**Tech Stack:** React, TypeScript, Firebase Firestore rules, Vitest

---

### Task 1: Fix tracked job rule validation

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Allow `interviewQuestions` to be either string or list**

```rules
(!hasField(data, 'interviewQuestions') ||
 ((data.interviewQuestions is string && data.interviewQuestions.size() < 50000) ||
  (data.interviewQuestions is list && data.interviewQuestions.size() <= 20)))
```

- [ ] **Step 2: Re-read the rule and confirm it still preserves existing tracked job constraints**

Expected: `coldEmail`, `tailoredResume`, and `contactEmail` validation remains unchanged while `interviewQuestions` accepts both formats.

### Task 2: Make paid asset persistence resilient

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`

- [ ] **Step 1: Add a helper that writes tracked job assets with one Firestore write per successful field**

```ts
const writeTrackedJobAssets = async (
  jobId: string,
  assets: Partial<Record<'coldEmail' | 'tailoredResume' | 'interviewQuestions', string>>
) => {
  const entries = Object.entries(assets).filter(([, value]) => typeof value === 'string' && value.trim().length > 0);

  for (const [field, value] of entries) {
    await setDoc(doc(db, 'trackedJobs', jobId), {
      [field]: value,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
};
```

- [ ] **Step 2: Use the helper after background generation instead of batching all assets into one write**

Expected: a bad `interviewQuestions` shape no longer blocks `coldEmail` from persisting.

### Task 3: Add one-click save on Daily Matches cards

**Files:**
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Test: `src/components/dashboard/__tests__/MatchesTab.test.ts`

- [ ] **Step 1: Thread `saveJob` into `MatchesTab` props**

```ts
saveJob: (j: Job) => void;
```

- [ ] **Step 2: Add a visible save button on each unlocked job card**

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={(event) => {
    event.stopPropagation();
    saveJob(item.job);
  }}
>
  Save
</Button>
```

- [ ] **Step 3: Extend the existing MatchesTab test to assert the save action renders for job cards**

```ts
expect(html).toContain('Save');
```

### Task 4: Verify and clean up

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `firestore.rules`
- Test: `src/components/dashboard/__tests__/MatchesTab.test.ts`

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- MatchesTab.test.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Check diagnostics in edited files**

Expected: no new TypeScript errors in the touched files.
