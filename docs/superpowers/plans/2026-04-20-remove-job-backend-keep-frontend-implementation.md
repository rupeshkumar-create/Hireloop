# Remove Job Backend Keep Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the jobs backend, Firestore job usage, routes, engines, and job-only docs while preserving a frontend-only dashboard experience.

**Architecture:** Replace the current jobs data flow with a frontend-safe placeholder hook and simplified dashboard tab, then delete the backend routes, cron handlers, engines, scripts, tests, and docs that only support jobs. Finish by verifying there are no remaining imports or route references to the removed job system and that the frontend still builds.

**Tech Stack:** TypeScript, React, Vite, Vercel routes, Firebase Firestore, Vitest

---

## File Map

**Modify**
- `src/hooks/useDashboardJobs.ts`
- `src/components/dashboard/MatchesTab.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/Sidebar.tsx` if it references jobs-specific navigation labels
- `SYSTEM_FLOW.md`

**Delete likely backend/runtime files**
- `api/jobs/index.ts`
- `api/cron/process-user.ts`
- `api/cron/daily-alerts.ts` if only used for jobs
- `scripts/generate-daily-jobs.ts`
- `src/services/cronEngine.ts`
- `src/services/jobResearcher.ts`
- `src/services/jobMatchingEngine.ts`
- `src/types/dailyJob.ts`

**Delete likely tests/docs**
- `src/components/dashboard/__tests__/MatchesTab.test.ts`
- job-specific specs/plans in `docs/superpowers/specs/`
- job-specific plans in `docs/superpowers/plans/`
- job-engine docs such as `JOB_ENGINE_FLOW.md`

**Verify dependent files**
- `src/components/dashboard/JobDetailsPanel.tsx`
- `src/components/dashboard/matchPaywall.ts`
- `src/pages/AdminDashboard.tsx`
- `src/lib/jobLinks.ts`
- `src/services/learningSignals.ts`
- `src/contexts/AuthContext.tsx`
- `vercel.json`
- `firestore.rules`

---

### Task 1: Replace The Jobs Hook With A Frontend-Only Placeholder

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`

- [ ] **Step 1: Replace job-loading imports with frontend-safe imports**

In `src/hooks/useDashboardJobs.ts`, remove Firestore job-loading and jobs-backend imports like these:

```ts
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import type { DailyJob } from '../types/dailyJob';
import type { Job, SortOption } from '../types/dashboard';
import {
  generateColdEmail,
  tailorResume,
  generateInterviewQuestions,
  updateLearningProfile,
} from '../services/aiService';
import { jobFingerprint } from '../services/jobResearcher';
```

Replace with a minimal frontend-only set such as:

```ts
import { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';
import type { Job, SortOption } from '../types/dashboard';
import { updateLearningProfile } from '../services/aiService';
import {
  applyLearningEvent,
  type LearningEventJob,
  type LearningSignals,
} from '../services/learningSignals';
import { isProPlan } from '../lib/planLimits';
```

- [ ] **Step 2: Replace the live jobs state with empty frontend-only state**

Replace the hook state/setup so there is no Firestore jobs read/write path:

```ts
const [jobs] = useState<Job[]>([]);
const [loadingJobs] = useState(false);
const [lastFetchTime] = useState<string | null>(null);
const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([]);
const [generatingJobs, setGeneratingJobs] = useState(false);
```

Remove:

- `getTodayIST()`
- `loadJobs()`
- `fetchJobs()` logic that reads daily matches
- `requestJobs()` logic that calls `/api/jobs`
- all references to `DailyJob`
- all references to `jobFingerprint()` from removed backend modules

- [ ] **Step 3: Rebuild filtering to operate on the empty local array**

Keep the hook API stable for the dashboard, but make it frontend-only:

```ts
const filteredAndSortedJobs = useMemo(() => {
  return jobs
    .filter((job) => {
      const key = `${job.title || ''}::${job.company || ''}`.toLowerCase();
      const passesWorkType =
        filterWorkType === 'all' ||
        job.workType === 'remote' ||
        (job.location || '').toLowerCase().includes('remote');

      return (
        !dismissedFingerprints.includes(key) &&
        passesWorkType &&
        (job.company || '').toLowerCase().includes(filterCompany.toLowerCase()) &&
        (job.location || '').toLowerCase().includes(filterLocation.toLowerCase()) &&
        (job.salary || '').toLowerCase().includes(filterSalary.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (sortBy === 'matchScore') return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      if (sortBy === 'company') return a.company.localeCompare(b.company);
      if (sortBy === 'datePosted') {
        return new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime();
      }
      return 0;
    });
}, [jobs, dismissedFingerprints, filterWorkType, filterCompany, filterLocation, filterSalary, sortBy]);
```

- [ ] **Step 4: Replace save/dismiss/request behavior with frontend-safe messages**

Use these minimal handlers:

```ts
const fetchJobs = async () => {
  toast.info('Job discovery is currently unavailable.');
};

const requestJobs = async () => {
  setGeneratingJobs(true);
  toast.info('Job generation has been removed from this version.');
  setGeneratingJobs(false);
};

const saveJob = async (_job: Job): Promise<boolean> => {
  toast.info('Saving jobs is currently unavailable.');
  return false;
};

const dismissJob = async (job: Job) => {
  const key = `${job.title || ''}::${job.company || ''}`.toLowerCase();
  setDismissedFingerprints((cur) => (cur.includes(key) ? cur : [...cur, key]));
};

const trackJobClick = async (_job: Job) => {};
```

- [ ] **Step 5: Run diagnostics on the hook**

Run:

```bash
npx tsc --noEmit
```

Expected: no new type errors from `src/hooks/useDashboardJobs.ts`.

---

### Task 2: Simplify The Matches UI To A Frontend Placeholder

**Files:**
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Verify: `src/components/dashboard/JobDetailsPanel.tsx`

- [ ] **Step 1: Remove backend-driven job rendering from the matches tab**

In `src/components/dashboard/MatchesTab.tsx`, remove imports tied to removed backend pieces such as:

```ts
import type { DailyJob } from '../../types/dailyJob';
import { buildMatchFeedItems } from './matchPaywall';
import { jobFingerprint } from '../../services/jobResearcher';
import { resolveJobApplicationUrlWithFallback, isJobUrlFallback } from '../../lib/jobLinks';
```

Replace the component body with a frontend-only placeholder UI:

```tsx
export function MatchesTab() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="mb-5">
        <h2 className="text-2xl tracking-tight text-foreground">Jobs</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Job discovery and matching are not available in this version.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-surface p-10 text-center">
        <div>
          <p className="text-lg font-medium text-foreground">Jobs feature removed</p>
          <p className="mt-2 text-sm text-foreground-muted">
            The frontend remains available, but backend job generation and live job feeds have been removed.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove dashboard job-detail dependencies**

In `src/pages/Dashboard.tsx`, remove:

```ts
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';
```

and simplify state from:

```ts
const [selectedJob, setSelectedJob] = useState<Job | null>(null);
const [savedJobFingerprints, setSavedJobFingerprints] = useState<string[]>([]);
const [savingJobFingerprints, setSavingJobFingerprints] = useState<string[]>([]);
```

to:

```ts
const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
```

Also remove:

- `handleSaveJob()`
- `JobDetailsPanel`
- all props passed only for live job behavior

- [ ] **Step 3: Simplify the matches tab usage in the dashboard**

Replace the `MatchesTab` render block with:

```tsx
<MatchesTab />
```

Keep the tab label if you want the frontend shell to remain, or rename it to `Jobs` if clearer.

- [ ] **Step 4: Verify no remaining imports from removed job-only modules in these files**

Run:

```bash
rg "dailyJob|jobResearcher|matchPaywall|jobLinks|JobDetailsPanel" src/pages/Dashboard.tsx src/components/dashboard/MatchesTab.tsx
```

Expected: no matches for removed dependencies.

- [ ] **Step 5: Run a frontend build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 3: Delete Backend Job Routes, Engines, Scripts, And Types

**Files:**
- Delete: `api/jobs/index.ts`
- Delete: `api/cron/process-user.ts`
- Delete: `api/cron/daily-alerts.ts` if only jobs
- Delete: `scripts/generate-daily-jobs.ts`
- Delete: `src/services/cronEngine.ts`
- Delete: `src/services/jobResearcher.ts`
- Delete: `src/services/jobMatchingEngine.ts`
- Delete: `src/types/dailyJob.ts`
- Modify: `vercel.json`
- Modify: `firestore.rules`

- [ ] **Step 1: Delete the backend route and engine files**

Run:

```bash
rm -f \
  api/jobs/index.ts \
  api/cron/process-user.ts \
  api/cron/daily-alerts.ts \
  scripts/generate-daily-jobs.ts \
  src/services/cronEngine.ts \
  src/services/jobResearcher.ts \
  src/services/jobMatchingEngine.ts \
  src/types/dailyJob.ts
```

Expected: those files are removed from the working tree.

- [ ] **Step 2: Remove jobs-specific Vercel function config**

In `vercel.json`, remove entries like:

```json
"api/jobs/index.ts": { "maxDuration": 300 },
"api/cron/process-user.ts": { "maxDuration": 300 },
"api/cron/daily-alerts.ts": { "maxDuration": 60 }
```

Also remove cron schedule entries that only exist for jobs:

```json
{
  "path": "/api/cron/daily-alerts",
  "schedule": "30 2 * * *"
}
```

- [ ] **Step 3: Remove jobs-specific Firestore rules**

In `firestore.rules`, delete rule sections for:

```text
users/{uid}/daily_matches/{date}
cronRuns
dailyJobs
lastJobFetchTime
seenJobFingerprints
```

Keep unrelated user/profile/trackedJobs rules intact.

- [ ] **Step 4: Verify no remaining route references**

Run:

```bash
rg "api/jobs|daily-alerts|process-user|generate-daily-jobs|cronEngine|jobResearcher|jobMatchingEngine|daily_matches|dailyJobs|lastJobFetchTime" . --glob '!dist/**' --glob '!node_modules/**'
```

Expected: matches only in docs that are about to be deleted or in unrelated historical text you intend to clean next.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove jobs backend and engines"
```

---

### Task 4: Delete Job-Only Tests And Documentation

**Files:**
- Delete: `src/components/dashboard/__tests__/MatchesTab.test.ts`
- Delete: job-only files in `docs/superpowers/specs/`
- Delete: job-only files in `docs/superpowers/plans/`
- Delete: `JOB_ENGINE_FLOW.md`
- Modify: `SYSTEM_FLOW.md`

- [ ] **Step 1: Delete clearly job-only tests and docs**

Run a focused delete for files that are entirely about jobs backend flow:

```bash
rm -f \
  src/components/dashboard/__tests__/MatchesTab.test.ts \
  JOB_ENGINE_FLOW.md
```

Then delete job-only spec/plan files after confirming names:

```bash
find docs/superpowers/specs docs/superpowers/plans -type f | grep -i "job\\|jobs\\|daily-alerts\\|cron-engine"
```

Expected: reviewable list of job-only docs before deletion.

- [ ] **Step 2: Remove deleted-system references from `SYSTEM_FLOW.md`**

Replace jobs-backend system descriptions with a short note that the backend jobs pipeline has been removed from the current version.

Use wording like:

```md
## Jobs Backend Status

The earlier backend jobs pipeline, cron processing, and Firestore-backed daily matches system have been removed from the current version of the app.
```

- [ ] **Step 3: Delete the confirmed job-only docs**

Run:

```bash
# replace with the exact reviewed file list from Step 1
rm -f <job-doc-file-1> <job-doc-file-2> <job-doc-file-3>
```

Expected: job-only docs removed, unrelated docs preserved.

- [ ] **Step 4: Verify no code imports deleted job test/docs artifacts**

Run:

```bash
rg "MatchesTab.test|JOB_ENGINE_FLOW|cron-engine|daily matches system" . --glob '!dist/**' --glob '!node_modules/**'
```

Expected: no runtime references; docs matches only where intentionally retained.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: remove jobs backend documentation"
```

---

### Task 5: Final Verification And Push

**Files:**
- Verify: whole repo

- [ ] **Step 1: Run a full frontend build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 2: Run targeted diagnostics**

Run:

```bash
npx tsc --noEmit
```

Expected: no unresolved imports or deleted symbol errors from job backend removal.

- [ ] **Step 3: Verify deleted backend files are gone and frontend placeholder remains**

Run:

```bash
find api src/services src/hooks src/components src/pages -type f | sort | grep -E "jobs|cron|match"
```

Expected: only the intentionally retained frontend placeholder files remain.

- [ ] **Step 4: Confirm git state**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the planned frontend simplification, backend deletions, docs cleanup, and config/rules cleanup remain.

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "refactor: remove jobs backend while keeping frontend shell"
git push origin main
```

Expected: branch updated and working tree clean.

---

## Self-Review

**Spec coverage**
- Remove backend routes: covered by Task 3.
- Remove engines/scripts/types: covered by Task 3.
- Stop Firestore job usage: covered by Tasks 1 and 3.
- Keep frontend but remove live functionality: covered by Tasks 1 and 2.
- Clean tests/docs: covered by Task 4.
- Verify build still works: covered by Task 5.

**Placeholder scan**
- No `TODO`, `TBD`, or vague implementation notes remain.
- Commands and files are explicit, with review points for risky deletions.

**Type consistency**
- The retained frontend API keeps `useDashboardJobs()` returning a stable object shape.
- Deleted backend modules are removed from both imports and Vercel config/rules references.
