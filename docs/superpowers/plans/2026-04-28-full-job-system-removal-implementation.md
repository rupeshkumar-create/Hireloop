# Full Job System Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the live job research + matching + daily job delivery subsystem from HireSchema while keeping the rest of the product stable, buildable, and usable.

**Architecture:** Replace the dashboard Jobs/Matches experience with a frontend-safe placeholder, remove admin job simulation, then delete the runtime routes, services, types, tests, and docs that power live job generation and delivery. Keep only non-job product surfaces and shared features that do not require the deleted pipeline.

**Tech Stack:** TypeScript, React, Vite, Vercel serverless routes, Firebase, Vitest

---

## File Map

**Modify**
- `src/components/dashboard/MatchesTab.tsx`
- `src/components/dashboard/__tests__/MatchesTab.test.ts`
- `src/hooks/useDashboardJobs.ts`
- `src/pages/Dashboard.tsx`
- `src/types/dashboard.ts`
- `src/pages/AdminDashboard.tsx`
- `src/services/emailService.ts`
- `vercel.json`
- `SYSTEM_FLOW.md`
- `CRON_FLOW.md`

**Delete**
- `api/jobs/index.ts`
- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `scripts/generate-daily-jobs.ts`
- `src/services/cronEngine.ts`
- `src/services/jobResearcher.ts`
- `src/services/jobMatchingEngine.ts`
- `src/types/dailyJob.ts`
- `src/services/adminGhostMode.ts`
- `src/types/adminGhostMode.ts`
- `src/services/__tests__/cronEngine.test.ts`
- `src/services/__tests__/adminGhostMode.test.ts`
- `src/components/admin/GhostModeModal.tsx`
- `src/components/dashboard/JobDetailsPanel.tsx`
- `src/components/dashboard/matchPaywall.ts`
- `src/lib/jobLinks.ts`
- `JOB_ENGINE_FLOW.md`
- `docs/superpowers/specs/2026-04-24-personalized-daily-job-delivery-design.md`
- `docs/superpowers/plans/2026-04-24-personalized-daily-job-delivery-implementation.md`

---

### Task 1: Replace The Matches Tab With A Static Placeholder

**Files:**
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/components/dashboard/__tests__/MatchesTab.test.ts`

- [ ] **Step 1: Rewrite the matches-tab test around the new placeholder behavior**

Replace `src/components/dashboard/__tests__/MatchesTab.test.ts` with:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchesTab } from '../MatchesTab';

describe('MatchesTab', () => {
  it('renders the feature-removed placeholder', () => {
    const html = renderToStaticMarkup(React.createElement(MatchesTab));

    expect(html).toContain('Jobs feature removed');
    expect(html).toContain('Job discovery and matching are not available in this version.');
    expect(html).not.toContain('Upgrade to Pro');
  });
});
```

- [ ] **Step 2: Run the rewritten test and verify it fails against the current component**

Run:

```bash
npx vitest run src/components/dashboard/__tests__/MatchesTab.test.ts
```

Expected:

```text
FAIL  src/components/dashboard/__tests__/MatchesTab.test.ts
+ expected output to contain "Jobs feature removed"
```

- [ ] **Step 3: Replace the matches tab implementation with a placeholder component**

Replace `src/components/dashboard/MatchesTab.tsx` with:

```tsx
export function MatchesTab() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-5">
        <h2 className="text-2xl tracking-tight text-foreground">Jobs</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Job discovery and matching are not available in this version.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-surface p-10 text-center">
        <div className="max-w-xl">
          <p className="text-lg font-medium text-foreground">Jobs feature removed</p>
          <p className="mt-2 text-sm text-foreground-muted">
            The app shell remains available, but backend job research, matching, and daily job feeds have been removed.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the placeholder test and verify it passes**

Run:

```bash
npx vitest run src/components/dashboard/__tests__/MatchesTab.test.ts
```

Expected:

```text
PASS  src/components/dashboard/__tests__/MatchesTab.test.ts
```

---

### Task 2: Remove Dashboard Dependencies On Live Jobs

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/types/dashboard.ts`

- [ ] **Step 1: Replace the aliased job type with a standalone frontend-safe shape**

Update `src/types/dashboard.ts` to:

```ts
export interface Job {
  id?: string;
  fingerprint?: string;
  title: string;
  company: string;
  location?: string;
  workType?: string;
  salary?: string;
  description?: string;
  source?: string;
  applyUrl?: string;
  postedAt?: string;
  requirements?: string[];
  matchScore?: number;
  finalScore?: number;
  matchReasons?: string[];
  skillGaps?: string[];
  aiSummary?: string;
  isHotJob?: boolean;
  hotSignals?: string[];
  companyStage?: string;
  estimatedSalary?: string;
}

export type SortOption = 'matchScore' | 'company' | 'datePosted';
```

- [ ] **Step 2: Replace the dashboard jobs hook with a placeholder-only hook**

Replace `src/hooks/useDashboardJobs.ts` with:

```ts
import { useMemo, useState } from 'react';
import type { Job, SortOption } from '../types/dashboard';

export function useDashboardJobs() {
  const [jobs] = useState<Job[]>([]);
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([]);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterSalary, setFilterSalary] = useState('');
  const [filterWorkType, setFilterWorkType] = useState<'remote' | 'all'>('remote');
  const [sortBy, setSortBy] = useState<SortOption>('matchScore');

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

  const fetchJobs = async () => {};
  const requestJobs = async () => {};
  const saveJob = async (_job: Job) => false;
  const dismissJob = async (job: Job) => {
    const key = `${job.title || ''}::${job.company || ''}`.toLowerCase();
    setDismissedFingerprints((cur) => (cur.includes(key) ? cur : [...cur, key]));
  };
  const trackJobClick = async (_job: Job) => {};

  return {
    filteredAndSortedJobs,
    loadingJobs: false,
    generatingJobs: false,
    requestJobs,
    stats: { saved: 0, applied: 0, interviewing: 0 },
    statsLoading: false,
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
    lastFetchTime: null,
    dailyJobsMeta: null,
    nextJobDeliveryAt: null,
  };
}
```

- [ ] **Step 3: Simplify the dashboard page to stop importing job-only UI and helpers**

Update `src/pages/Dashboard.tsx` imports and state to:

```tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, List } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { OverviewTab } from '../components/dashboard/OverviewTab';
import { MatchesTab } from '../components/dashboard/MatchesTab';
import { PageShell } from '../components/ui/page-shell';

export function Dashboard() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');

  const { stats, statsLoading } = useDashboardJobs();
```

Then replace the matches-tab render block with:

```tsx
{activeTab === 'matches' && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex min-h-0 flex-1 flex-col"
  >
    <MatchesTab />
  </motion.div>
)}
```

Delete these pieces entirely from `Dashboard.tsx`:

```tsx
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';

const [selectedJob, setSelectedJob] = useState<Job | null>(null);
const [savedJobFingerprints, setSavedJobFingerprints] = useState<string[]>([]);
const [savingJobFingerprints, setSavingJobFingerprints] = useState<string[]>([]);
```

- [ ] **Step 4: Run typecheck to catch remaining dashboard/job-type errors**

Run:

```bash
npm run lint
```

Expected:

```text
TypeScript completes without errors from useDashboardJobs, Dashboard, or dashboard.ts
```

---

### Task 3: Remove Admin Ghost Mode And Job-Simulation Paths

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`
- Delete: `src/services/adminGhostMode.ts`
- Delete: `src/components/admin/GhostModeModal.tsx`
- Delete: `src/types/adminGhostMode.ts`
- Delete: `src/services/__tests__/adminGhostMode.test.ts`

- [ ] **Step 1: Delete ghost-mode tests and modal/types files that only exist for job simulation**

Delete:

```text
src/services/__tests__/adminGhostMode.test.ts
src/components/admin/GhostModeModal.tsx
src/services/adminGhostMode.ts
src/types/adminGhostMode.ts
```

- [ ] **Step 2: Run typecheck to surface remaining admin import breakages**

Run:

```bash
npm run lint
```

Expected:

```text
TypeScript errors in src/pages/AdminDashboard.tsx for deleted ghost-mode imports and symbols
```

- [ ] **Step 3: Strip AdminDashboard down to user-management-only behavior**

Remove these imports:

```tsx
import { runAdminGhostMode } from '../services/adminGhostMode';
import { researchJobs } from '../services/jobResearcher';
import type { CallAIFn } from '../services/jobResearcher';
import { matchAndRankJobs } from '../services/jobMatchingEngine';
import { GhostModeModal } from '../components/admin/GhostModeModal';
import type {
  GhostModeInputMode,
  GhostModeOverrides,
  GhostModeRunMode,
  GhostModeRunResult,
  GhostModeTargetUser,
} from '../types/adminGhostMode';
```

Remove the state and handlers that support ghost mode (and the `<GhostModeModal />` render block).

- [ ] **Step 4: Run typecheck again**

Run:

```bash
npm run lint
```

Expected:

```text
TypeScript completes without references to GhostMode, jobResearcher, or jobMatchingEngine in AdminDashboard
```

---

### Task 4: Delete Runtime Job Routes, Services, Types, And Job Email Logic

**Files:**
- Modify: `src/services/emailService.ts`
- Modify: `vercel.json`
- Delete: `api/jobs/index.ts`
- Delete: `api/cron/daily-alerts.ts`
- Delete: `api/cron/process-user.ts`
- Delete: `scripts/generate-daily-jobs.ts`
- Delete: `src/services/cronEngine.ts`
- Delete: `src/services/jobResearcher.ts`
- Delete: `src/services/jobMatchingEngine.ts`
- Delete: `src/types/dailyJob.ts`
- Delete: `src/services/__tests__/cronEngine.test.ts`
- Delete: `src/components/dashboard/JobDetailsPanel.tsx`
- Delete: `src/components/dashboard/matchPaywall.ts`
- Delete: `src/lib/jobLinks.ts`

- [ ] **Step 1: Remove the daily job digest helpers from emailService**

Update `src/services/emailService.ts` so it only keeps the shared `sendResendEmail()` helper and the signup email:

```ts
const sendResendEmail = async (payload: any) => {
  try {
    const response = await fetch('/api/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error response:', data);
      throw new Error(data.error || 'Failed to send email');
    }
    return data;
  } catch (error) {
    console.error('Error in sendResendEmail:', error);
    throw error;
  }
};

export const sendSignupEmail = async (userEmail: string, userName: string) => {
  return sendResendEmail({
    from: 'Hireschema <onboarding@hireschema.com>',
    to: [userEmail],
    subject: 'Welcome to Hireschema',
    html: `
      <div style="font-family: sans-serif; color: #18181b;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to Hireschema.</h1>
        <p style="font-size: 16px; margin-bottom: 24px;">Your AI recruiting agent is ready. Upload your resume to start getting daily job matches curated just for you.</p>
        <a href="https://hireschema.com/dashboard" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">Go to Dashboard</a>
      </div>
    `,
  });
};
```

- [ ] **Step 2: Delete the runtime files that power the jobs subsystem**

Delete:

```text
api/jobs/index.ts
api/cron/daily-alerts.ts
api/cron/process-user.ts
scripts/generate-daily-jobs.ts
src/services/cronEngine.ts
src/services/jobResearcher.ts
src/services/jobMatchingEngine.ts
src/types/dailyJob.ts
src/services/__tests__/cronEngine.test.ts
src/components/dashboard/JobDetailsPanel.tsx
src/components/dashboard/matchPaywall.ts
src/lib/jobLinks.ts
```

- [ ] **Step 3: Remove Vercel job function config and cron schedule**

Update `vercel.json` by removing any function config for deleted job routes and removing the cron entry for `/api/cron/daily-alerts`.

- [ ] **Step 4: Search for leftover job-pipeline references and fix any remaining compile paths**

Run:

```bash
rg "jobResearcher|jobMatchingEngine|cronEngine|daily_matches|dailyJobs|dailyJobsMeta|DailyJob|GhostModeModal|runAdminGhostMode|/api/jobs|daily-alerts|process-user" src api scripts vercel.json
```

Expected:

```text
No active runtime source files import or reference the deleted jobs pipeline.
```

- [ ] **Step 5: Run typecheck and build after the deletion**

Run:

```bash
npm run lint
npm run build
```

Expected:

```text
TypeScript passes
vite build completes successfully
```

---

### Task 5: Update Root Docs And Remove Job-Pipeline Documentation

**Files:**
- Modify: `SYSTEM_FLOW.md`
- Modify: `CRON_FLOW.md`
- Delete: `JOB_ENGINE_FLOW.md`
- Delete: `docs/superpowers/specs/2026-04-24-personalized-daily-job-delivery-design.md`
- Delete: `docs/superpowers/plans/2026-04-24-personalized-daily-job-delivery-implementation.md`

- [ ] **Step 1: Rewrite SYSTEM_FLOW to remove the live jobs pipeline**

Replace job-pipeline-specific sections in `SYSTEM_FLOW.md` with:

```md
# SYSTEM_FLOW.md

## Purpose

This document defines the current high-level system flow for HireSchema.

The live jobs research, matching, and daily delivery engine has been removed from the app.

## Active Product Areas

- onboarding and profile setup
- dashboard shell and account surfaces
- AI assistance features such as resume tailoring, cold email generation, and interview preparation
- marketing/blog automation
- admin user management

## Inactive / Removed

- live job discovery
- job matching and ranking
- daily job cron delivery
- dashboard daily matches as an active backend-fed feature

## Design Intent

Top-level docs must describe only currently active runtime systems.
Removed systems should not be documented here as if they still run in production.
```

- [ ] **Step 2: Rewrite CRON_FLOW so it only describes active cron routes**

Replace `CRON_FLOW.md` with:

```md
# CRON_FLOW.md

## Purpose

This document describes the active cron flows in HireSchema.

## Active Cron Routes

- `/api/cron/daily-blog`
- `/api/cron/weekly-analysis`

## Removed

The daily jobs dispatcher and per-user jobs processor were removed with the live jobs subsystem.

Cron documentation must not describe removed job-delivery behavior as active.
```

- [ ] **Step 3: Delete job-engine docs that are now misleading**

Delete:

```text
JOB_ENGINE_FLOW.md
docs/superpowers/specs/2026-04-24-personalized-daily-job-delivery-design.md
docs/superpowers/plans/2026-04-24-personalized-daily-job-delivery-implementation.md
```

- [ ] **Step 4: Search docs for stale “active job engine” claims and clean them up**

Run:

```bash
rg "job engine|daily matches|daily-alerts|process-user|jobMatchingEngine|jobResearcher" . --glob '*.md'
```

Expected:

```text
Remaining hits are either removal docs or explicit notes that the job system is removed.
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npx vitest run src/components/dashboard/__tests__/MatchesTab.test.ts src/lib/__tests__/adminUsers.test.ts src/server/__tests__/firebaseAdmin.test.ts
```

Expected:

```text
All selected tests pass
```

- [ ] **Step 2: Run one final stale-reference search**

Run:

```bash
rg "jobResearcher|jobMatchingEngine|cronEngine|DailyJob|daily_matches|/api/jobs|daily-alerts|process-user|GhostModeModal|runAdminGhostMode" src api docs vercel.json
```

Expected:

```text
Only intentional references in removal docs remain
```

