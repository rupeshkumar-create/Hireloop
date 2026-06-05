# Phase 7 Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `free -> 1` and `pro -> 10` daily match limits through a shared helper, then add a locked Daily Matches paywall with an upgrade CTA for free users.

**Architecture:** Add a tiny shared `planLimits` utility so every match-limit decision uses the same rule. Add a focused `matchPaywall` helper that builds real-job plus locked-slot feed items, then wire `useDashboardJobs.ts`, `Dashboard.tsx`, `MatchesTab.tsx`, and `Settings.tsx` to consume those helpers without fetching extra hidden jobs for free users.

**Tech Stack:** TypeScript, React, React Router, Vite, Vitest

---

## File Structure

- Create: `src/lib/planLimits.ts`
- Create: `src/lib/__tests__/planLimits.test.ts`
- Create: `src/components/dashboard/matchPaywall.ts`
- Create: `src/components/dashboard/__tests__/matchPaywall.test.ts`
- Create: `src/components/dashboard/__tests__/MatchesTab.test.tsx`
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/pages/Settings.tsx`

Each file has one clear role:

- `planLimits.ts`: one source of truth for `free` vs `pro` daily limits
- `planLimits.test.ts`: unit coverage for plan normalization and entitlement fallback
- `matchPaywall.ts`: pure helper that appends locked placeholder slots for free users
- `matchPaywall.test.ts`: unit coverage for placeholder-slot generation
- `MatchesTab.test.tsx`: markup-level regression coverage for free vs pro rendering
- `useDashboardJobs.ts`: fetch-time enforcement and cache sufficiency checks
- `Dashboard.tsx`: passes plan context into the matches UI
- `MatchesTab.tsx`: renders the locked paywall cards and upgrade CTA
- `Settings.tsx`: adds a stable anchor target for the CTA

### Task 1: Add the Shared Plan-Limit Helper

**Files:**
- Create: `src/lib/planLimits.ts`
- Create: `src/lib/__tests__/planLimits.test.ts`
- Test: `src/lib/__tests__/planLimits.test.ts`

- [ ] **Step 1: Write the failing plan-limit tests**

Create `src/lib/__tests__/planLimits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FREE_DAILY_MATCH_LIMIT,
  PRO_DAILY_MATCH_LIMIT,
  getDailyMatchLimit,
  isProPlan,
} from '../planLimits';

describe('getDailyMatchLimit', () => {
  it('returns the free limit when the plan is missing', () => {
    expect(getDailyMatchLimit()).toBe(FREE_DAILY_MATCH_LIMIT);
  });

  it('normalizes the plan string before checking pro access', () => {
    expect(getDailyMatchLimit('Pro')).toBe(PRO_DAILY_MATCH_LIMIT);
    expect(getDailyMatchLimit(' pro ')).toBe(PRO_DAILY_MATCH_LIMIT);
  });

  it('falls back to the free limit for unknown plans', () => {
    expect(getDailyMatchLimit('enterprise')).toBe(FREE_DAILY_MATCH_LIMIT);
  });
});

describe('isProPlan', () => {
  it('returns true only for normalized pro plans', () => {
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('Pro')).toBe(true);
    expect(isProPlan('free')).toBe(false);
    expect(isProPlan(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/lib/__tests__/planLimits.test.ts
```

Expected: FAIL because `src/lib/planLimits.ts` does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `src/lib/planLimits.ts`:

```ts
export const FREE_DAILY_MATCH_LIMIT = 1;
export const PRO_DAILY_MATCH_LIMIT = 10;

function normalizePlan(plan?: string): string {
  return (plan || '').trim().toLowerCase();
}

export function isProPlan(plan?: string): boolean {
  return normalizePlan(plan) === 'pro';
}

export function getDailyMatchLimit(plan?: string): number {
  return isProPlan(plan) ? PRO_DAILY_MATCH_LIMIT : FREE_DAILY_MATCH_LIMIT;
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- src/lib/__tests__/planLimits.test.ts
```

Expected: PASS with all plan-limit assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planLimits.ts src/lib/__tests__/planLimits.test.ts
git commit -m "feat: add shared plan limit helper"
```

### Task 2: Enforce the Shared Limit in the Dashboard Jobs Hook

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Test: `src/lib/__tests__/planLimits.test.ts`

- [ ] **Step 1: Import the shared helper**

Update the imports at the top of `src/hooks/useDashboardJobs.ts`:

```ts
import { getDailyMatchLimit } from '../lib/planLimits';
```

- [ ] **Step 2: Replace inline limit checks with the helper**

Update the cache hydration effect in `src/hooks/useDashboardJobs.ts`:

```ts
  useEffect(() => {
    if (profile?.dailyJobs && jobs.length === 0 && !loadingJobs) {
      const expectedLimit = getDailyMatchLimit(profile?.plan);
      if (profile.dailyJobs.length < expectedLimit) {
        fetchJobs(true);
      } else {
        setJobs(profile.dailyJobs);
      }
    }
  }, [profile?.dailyJobs, profile?.plan]);
```

Update `fetchJobs()` in the same file:

```ts
  const fetchJobs = async (forceRefresh: boolean = false) => {
    if (!profile?.careerPaths || profile.careerPaths.length === 0) {
      toast.error("Please set your Career Paths in Settings first.");
      return;
    }

    const mostRecent8AM = getMostRecent8AMIST();
    const lastFetch = profile.lastJobFetchTime ? new Date(profile.lastJobFetchTime) : null;
    const limit = getDailyMatchLimit(profile?.plan);

    if (
      !forceRefresh &&
      lastFetch &&
      lastFetch >= mostRecent8AM &&
      profile.dailyJobs &&
      profile.dailyJobs.length >= limit
    ) {
      setJobs(profile.dailyJobs);
      return;
    }

    setLoadingJobs(true);
    try {
      const seenFingerprints: string[] = profile.seenJobFingerprints || [];

      const result = await generateDailyJobs(
        profile.careerPaths,
        profile.jobType || 'both',
        profile.minSalary || null,
        profile.resumeText || '',
        limit,
        seenFingerprints,
        profile.learningProfile?.jobPreferences || '',
        profile.location || '',
        profile.learningSignals
      );

      const results = result.jobs;
      setJobs(results);
      // keep the existing persistence logic below unchanged
    } catch (error: any) {
      if (error.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue finding jobs.', { duration: 6000 });
      } else {
        toast.error(error.message || "Failed to fetch jobs.");
      }
    } finally {
      setLoadingJobs(false);
    }
  };
```

- [ ] **Step 3: Run the targeted helper test as a quick regression**

Run:

```bash
npm test -- src/lib/__tests__/planLimits.test.ts
```

Expected: PASS, confirming the hook now consumes the shared contract without changing it.

- [ ] **Step 4: Run the type check on the edited hook**

Run:

```bash
npm run lint
```

Expected: PASS with no new TypeScript errors from `useDashboardJobs.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardJobs.ts
git commit -m "feat: enforce shared daily match limits"
```

### Task 3: Add a Pure Paywall-Slot Builder

**Files:**
- Create: `src/components/dashboard/matchPaywall.ts`
- Create: `src/components/dashboard/__tests__/matchPaywall.test.ts`
- Test: `src/components/dashboard/__tests__/matchPaywall.test.ts`

- [ ] **Step 1: Write the failing paywall-helper tests**

Create `src/components/dashboard/__tests__/matchPaywall.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMatchFeedItems } from '../matchPaywall';
import type { Job } from '../../../types/dashboard';

const sampleJob: Job = {
  title: 'Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$120k',
  description: 'Build product UI',
  url: 'https://example.com/jobs/1',
  requirements: ['React', 'TypeScript'],
  matchScore: 92,
};

describe('buildMatchFeedItems', () => {
  it('appends nine locked placeholders for a free user with one real job', () => {
    const result = buildMatchFeedItems([sampleJob], 'free');

    expect(result).toHaveLength(10);
    expect(result[0].kind).toBe('job');
    expect(result.filter((item) => item.kind === 'locked')).toHaveLength(9);
  });

  it('does not append placeholders for pro users', () => {
    const result = buildMatchFeedItems([sampleJob, { ...sampleJob, title: 'Platform Engineer' }], 'pro');

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.kind === 'job')).toBe(true);
  });

  it('keeps the empty state honest when there are no jobs', () => {
    expect(buildMatchFeedItems([], 'free')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/components/dashboard/__tests__/matchPaywall.test.ts
```

Expected: FAIL because `src/components/dashboard/matchPaywall.ts` does not exist yet.

- [ ] **Step 3: Implement the pure paywall helper**

Create `src/components/dashboard/matchPaywall.ts`:

```ts
import type { Job } from '../../types/dashboard';
import { PRO_DAILY_MATCH_LIMIT, isProPlan } from '../../lib/planLimits';

export interface LockedMatchSlot {
  kind: 'locked';
  index: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  teaser: string;
}

export type MatchFeedItem =
  | { kind: 'job'; id: string; job: Job }
  | { kind: 'locked'; id: string; slot: LockedMatchSlot };

export function buildMatchFeedItems(jobs: Job[], plan?: string): MatchFeedItem[] {
  const realItems: MatchFeedItem[] = jobs.map((job, index) => ({
    kind: 'job',
    id: `job-${index}-${job.company}-${job.title}`,
    job,
  }));

  if (jobs.length === 0 || isProPlan(plan)) {
    return realItems;
  }

  const lockedCount = Math.max(PRO_DAILY_MATCH_LIMIT - jobs.length, 0);

  const lockedItems: MatchFeedItem[] = Array.from({ length: lockedCount }, (_, index) => ({
    kind: 'locked',
    id: `locked-${index}`,
    slot: {
      kind: 'locked',
      index,
      title: 'Premium Match',
      company: 'Hidden until you upgrade',
      location: 'Remote',
      salary: 'Top-fit role',
      teaser: 'Unlock 9 more AI-picked jobs daily',
    },
  }));

  return [...realItems, ...lockedItems];
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- src/components/dashboard/__tests__/matchPaywall.test.ts
```

Expected: PASS with the slot-builder behavior green.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/matchPaywall.ts src/components/dashboard/__tests__/matchPaywall.test.ts
git commit -m "feat: add daily matches paywall slot helper"
```

### Task 4: Render the Locked Matches UI and Upgrade CTA

**Files:**
- Create: `src/components/dashboard/__tests__/MatchesTab.test.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/pages/Settings.tsx`
- Test: `src/components/dashboard/__tests__/MatchesTab.test.tsx`

- [ ] **Step 1: Write the failing matches-tab rendering test**

Create `src/components/dashboard/__tests__/MatchesTab.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MatchesTab } from '../MatchesTab';
import type { Job } from '../../../types/dashboard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const sampleJob: Job = {
  title: 'Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$120k',
  description: 'Build product UI',
  url: 'https://example.com/jobs/1',
  requirements: ['React', 'TypeScript'],
  matchScore: 92,
};

function renderMatches(plan?: string, jobs: Job[] = [sampleJob]) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MatchesTab
        plan={plan}
        jobs={jobs}
        loadingJobs={false}
        fetchJobs={() => {}}
        filterCompany=""
        setFilterCompany={() => {}}
        filterLocation=""
        setFilterLocation={() => {}}
        filterSalary=""
        setFilterSalary={() => {}}
        sortBy="matchScore"
        setSortBy={() => {}}
        selectedJob={null}
        setSelectedJob={() => {}}
        setAiAction={() => {}}
        dismissJob={() => {}}
      />
    </MemoryRouter>
  );
}

describe('MatchesTab paywall rendering', () => {
  it('shows locked placeholders and the upgrade CTA for free users', () => {
    const html = renderMatches('free');

    expect(html).toContain('Upgrade to Pro');
    expect(html).toContain('Unlock 9 more AI-picked jobs daily');
    expect((html.match(/Premium Match/g) || []).length).toBe(9);
  });

  it('does not show locked placeholders for pro users', () => {
    const html = renderMatches('pro', [
      sampleJob,
      { ...sampleJob, title: 'Platform Engineer', url: 'https://example.com/jobs/2' },
    ]);

    expect(html).not.toContain('Upgrade to Pro');
    expect(html).not.toContain('Premium Match');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/components/dashboard/__tests__/MatchesTab.test.tsx
```

Expected: FAIL because `MatchesTab` does not yet accept a `plan` prop or render locked paywall cards.

- [ ] **Step 3: Pass the user plan from `Dashboard` into `MatchesTab`**

Update the `MatchesTab` usage in `src/pages/Dashboard.tsx`:

```tsx
              <MatchesTab 
                plan={profile?.plan}
                jobs={filteredAndSortedJobs}
                loadingJobs={loadingJobs}
                fetchJobs={fetchJobs}
                filterCompany={filterCompany}
                setFilterCompany={setFilterCompany}
                filterLocation={filterLocation}
                setFilterLocation={setFilterLocation}
                filterSalary={filterSalary}
                setFilterSalary={setFilterSalary}
                sortBy={sortBy}
                setSortBy={setSortBy}
                selectedJob={selectedJob}
                setSelectedJob={setSelectedJob}
                setAiAction={setAiAction}
                dismissJob={dismissJob}
              />
```

- [ ] **Step 4: Implement the locked paywall UI in `MatchesTab`**

Update `src/components/dashboard/MatchesTab.tsx`:

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, MapPin, DollarSign, Calendar, ArrowUpDown, Plane, X, Lock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Job, SortOption } from '../../types/dashboard';
import { cn } from '../../lib/utils';
import { isProPlan } from '../../lib/planLimits';
import { buildMatchFeedItems } from './matchPaywall';

interface MatchesTabProps {
  plan?: string;
  jobs: Job[];
  loadingJobs: boolean;
  fetchJobs: (force?: boolean) => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterSalary: string;
  setFilterSalary: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  selectedJob: Job | null;
  setSelectedJob: (j: Job | null) => void;
  setAiAction: (v: any) => void;
  dismissJob: (j: Job) => void;
}

export function MatchesTab({
  plan,
  jobs,
  loadingJobs,
  fetchJobs,
  filterCompany,
  setFilterCompany,
  filterLocation,
  setFilterLocation,
  filterSalary,
  setFilterSalary,
  sortBy,
  setSortBy,
  selectedJob,
  setSelectedJob,
  setAiAction,
  dismissJob,
}: MatchesTabProps) {
  const feedItems = buildMatchFeedItems(jobs, plan);
  const showLockedCards = !isProPlan(plan) && jobs.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl tracking-tight text-foreground">Your Daily Matches</h2>
          <p className="mt-1 text-sm text-foreground-muted">Curated jobs based on your preferences and resume.</p>
        </div>
        {showLockedCards && (
          <Link to="/settings#billing-plan">
            <Button variant="action">Upgrade to Pro</Button>
          </Link>
        )}
      </div>

      <div className="mb-4 flex w-full flex-shrink-0 flex-col gap-3 rounded-[28px] border border-border bg-surface p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="grid flex-1 w-full grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            placeholder="Filter by company..."
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="w-full text-sm"
          />
          <Input
            placeholder="Filter by location..."
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="w-full text-sm"
          />
          <Input
            placeholder="Filter by salary..."
            value={filterSalary}
            onChange={(e) => setFilterSalary(e.target.value)}
            className="w-full text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-foreground-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground-muted outline-none focus:ring-2 focus:ring-[#3898ec]"
          >
            <option value="matchScore">Match Score</option>
            <option value="datePosted">Newest First</option>
            <option value="company">Company (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-8">
        {loadingJobs ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <p className="text-foreground-muted font-medium animate-pulse">Scouring the web for the best opportunities...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-foreground-muted">No jobs found matching your filters.</div>
        ) : (
          <AnimatePresence>
            {feedItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                {item.kind === 'job' ? (
                  <Card
                    className={cn(
                      "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-border-strong",
                      selectedJob === item.job ? "border-border-strong ring-1 ring-ring" : ""
                    )}
                    onClick={() => {
                      setSelectedJob(item.job);
                      setAiAction(null);
                    }}
                  >
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-foreground font-display text-lg">{item.job.title}</h3>
                          <p className="text-foreground-muted font-medium">{item.job.company}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          {item.job.matchScore !== undefined && (
                            <Badge variant={item.job.matchScore >= 80 ? 'success' : 'secondary'} className="ml-2 font-semibold">
                              {item.job.matchScore}% Match
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground-muted"
                            onClick={(event) => {
                              event.stopPropagation();
                              dismissJob(item.job);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-4 text-sm text-foreground-muted">
                        <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-foreground-muted" /> {item.job.location}</div>
                        {item.job.requiresRelocation && (
                          <div className="flex items-center text-[rgba(201,100,66,1)]" title="Requires relocation">
                            <Plane className="mr-1.5 h-4 w-4" /> Relocation
                          </div>
                        )}
                        <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-foreground-muted" /> {item.job.salary}</div>
                        {item.job.datePosted && (
                          <div className="flex items-center"><Calendar className="mr-1.5 h-4 w-4 text-foreground-muted" /> {new Date(item.job.datePosted).toLocaleDateString()}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="relative overflow-hidden border-border bg-surface/90">
                    <CardContent className="p-5">
                      <div className="pointer-events-none select-none blur-[3px] opacity-80">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-foreground font-display text-lg">{item.slot.title}</h3>
                            <p className="text-foreground-muted font-medium">{item.slot.company}</p>
                          </div>
                          <Badge variant="secondary" className="font-semibold">Locked</Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-foreground-muted">
                          <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-foreground-muted" /> {item.slot.location}</div>
                          <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-foreground-muted" /> {item.slot.salary}</div>
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(248,245,239,0.72)] backdrop-blur-sm">
                        <div className="mx-6 flex max-w-xs flex-col items-center rounded-2xl border border-border bg-background/95 px-5 py-4 text-center shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                          <Lock className="mb-2 h-5 w-5 text-primary" />
                          <p className="text-sm font-medium text-foreground">{item.slot.teaser}</p>
                          <p className="mt-1 text-xs text-foreground-muted">Go Pro to unlock the full 10-match daily feed.</p>
                          {item.slot.index === 0 && (
                            <Link to="/settings#billing-plan" className="mt-3">
                              <Button variant="action" size="sm">Upgrade to Pro</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add a billing anchor target**

Update the billing card in `src/pages/Settings.tsx`:

```tsx
        <Card id="billing-plan">
          <CardHeader>
            <CardTitle>Billing & Plan</CardTitle>
            <CardDescription>Manage your subscription and upgrade to Pro.</CardDescription>
          </CardHeader>
```

- [ ] **Step 6: Run the matches rendering test**

Run:

```bash
npm test -- src/components/dashboard/__tests__/MatchesTab.test.tsx
```

Expected: PASS with free-tier paywall rendering and pro-tier no-paywall behavior both green.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx src/components/dashboard/MatchesTab.tsx src/pages/Settings.tsx src/components/dashboard/__tests__/MatchesTab.test.tsx
git commit -m "feat: add daily matches paywall ui"
```

### Task 5: Final Verification

**Files:**
- Test: `src/lib/__tests__/planLimits.test.ts`
- Test: `src/components/dashboard/__tests__/matchPaywall.test.ts`
- Test: `src/components/dashboard/__tests__/MatchesTab.test.tsx`
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Run the targeted monetization test suite**

Run:

```bash
npm test -- src/lib/__tests__/planLimits.test.ts src/components/dashboard/__tests__/matchPaywall.test.ts src/components/dashboard/__tests__/MatchesTab.test.tsx
```

Expected: PASS with all Phase 7 monetization tests green.

- [ ] **Step 2: Run the repo type check**

Run:

```bash
npm run lint
```

Expected: PASS with no new TypeScript diagnostics from the monetization changes.

- [ ] **Step 3: Check IDE diagnostics for edited files**

Check diagnostics for:

```text
src/lib/planLimits.ts
src/hooks/useDashboardJobs.ts
src/components/dashboard/matchPaywall.ts
src/components/dashboard/MatchesTab.tsx
src/pages/Dashboard.tsx
src/pages/Settings.tsx
```

Expected: no newly introduced file-level errors.

- [ ] **Step 4: Smoke-test the product manually**

Verify in the running app:

```text
1. Sign in as a free user with one fetched match and confirm the list shows 1 real job plus 9 locked placeholders.
2. Click the paywall CTA and confirm it lands on /settings#billing-plan.
3. Sign in as a pro user and confirm no locked placeholders render.
4. Upgrade a free user to pro, refresh the dashboard, and confirm the existing refresh behavior attempts to fill the list toward 10 jobs.
5. Confirm the free path still stores and displays only 1 real job rather than fetching hidden extras.
```

- [ ] **Step 5: Commit the verification pass**

```bash
git add src/lib/planLimits.ts src/lib/__tests__/planLimits.test.ts src/hooks/useDashboardJobs.ts src/components/dashboard/matchPaywall.ts src/components/dashboard/__tests__/matchPaywall.test.ts src/components/dashboard/__tests__/MatchesTab.test.tsx src/components/dashboard/MatchesTab.tsx src/pages/Dashboard.tsx src/pages/Settings.tsx
git commit -m "test: verify phase 7 monetization flow"
```

## Self-Review

- Spec coverage:
  - shared `free -> 1` and `pro -> 10` enforcement: Tasks 1 and 2
  - placeholder-only paywall slots instead of hidden real jobs: Task 3
  - blurred locked cards and upgrade CTA: Task 4
  - billing route handoff and free/pro rendering verification: Tasks 4 and 5
- Placeholder scan:
  - no `TODO`, `TBD`, or “implement later” placeholders remain
  - every code-changing step includes concrete code
  - every validation step includes exact commands and expected outcomes
- Type consistency:
  - `getDailyMatchLimit()` and `isProPlan()` are defined once in `planLimits.ts`
  - `buildMatchFeedItems()` is defined once in `matchPaywall.ts` and consumed by `MatchesTab.tsx`
  - `MatchesTab` accepts `plan?: string` and `Dashboard.tsx` is the matching caller
